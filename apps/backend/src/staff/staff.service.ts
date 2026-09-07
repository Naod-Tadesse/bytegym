import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { and, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm';

import {
  assertCanGrantScope,
  assertCanWriteToBranch,
  assertInScope,
} from '../common/branch-scope';
import type { AccountStatus } from '../common/enums';
import { countOf, paginated, toOffset } from '../common/paginate';
import { isUniqueViolation } from '../common/pg-errors';
import type { StaffQueryDto } from './dto/staff-query.dto';
import type { Database, Transaction } from '../database/database.client';
import { DRIZZLE } from '../database/database.constants';
import * as schema from '../database/schema';
import { nextStaffCode } from '../database/staff-code';
import type {
  GrantStaffAccessDto,
  SetStaffAuthorizationDto,
} from './dto/reset-password.dto';
import type { CreateStaffDto, UpdateStaffDto } from './dto/staff.dto';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class StaffService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async findAll(query: StaffQueryDto, scope: string | null) {
    const { page, limit, offset } = toOffset(query.page, query.limit);

    const conditions = [isNull(schema.person.deletedAt)];
    // `null` scope means every branch — see branchScopeOf.
    if (scope) {
      conditions.push(eq(schema.staff.primaryBranchId, scope));
    }
    if (query.search) {
      const term = `%${query.search}%`;
      const match = or(
        ilike(schema.person.firstName, term),
        ilike(schema.person.lastName, term),
        ilike(schema.person.phone, term),
        ilike(schema.staff.staffCode, term),
      );
      if (match) conditions.push(match);
    }
    // Splits the roster from the system users. Expressed as EXISTS rather than
    // a join condition so the count query, which does not join accounts, can
    // reuse the same `where` unchanged.
    if (query.hasAccount !== undefined) {
      const hasAccount = sql`exists (select 1 from ${schema.accounts} where ${schema.accounts.personId} = ${schema.staff.personId})`;
      conditions.push(query.hasAccount ? hasAccount : sql`not ${hasAccount}`);
    }
    const where = and(...conditions);

    const columns = {
      personId: schema.staff.personId,
      staffCode: schema.staff.staffCode,
      jobTitleId: schema.staff.jobTitleId,
      jobTitle: schema.jobTitles.name,
      employmentStatus: schema.staff.employmentStatus,
      dataScope: schema.staff.dataScope,
      hiredOn: schema.staff.hiredOn,
      firstName: schema.person.firstName,
      lastName: schema.person.lastName,
      phone: schema.person.phone,
      status: schema.accounts.status,
      // On the list as well as the detail: the Users screen shows it per row,
      // and fetching the detail for each would be an N+1.
      lastLoginAt: schema.accounts.lastLoginAt,
      branchId: schema.branches.id,
      branchName: schema.branches.name,
      // Whether they can sign in at all. A cleaner has no accounts row.
      hasAccount: sql<boolean>`${schema.accounts.id} is not null`,
      createdAt: schema.staff.createdAt,
    };

    const [rows, countRows] = await Promise.all([
      this.db
        .select(columns)
        .from(schema.staff)
        .innerJoin(schema.person, eq(schema.person.id, schema.staff.personId))
        .innerJoin(
          schema.jobTitles,
          eq(schema.jobTitles.id, schema.staff.jobTitleId),
        )
        .innerJoin(
          schema.branches,
          eq(schema.branches.id, schema.staff.primaryBranchId),
        )
        .leftJoin(
          schema.accounts,
          eq(schema.accounts.personId, schema.staff.personId),
        )
        .where(where)
        .limit(limit)
        .offset(offset)
        .orderBy(schema.staff.createdAt),
      this.db
        .select({ count: sql<number>`count(*)` })
        .from(schema.staff)
        .innerJoin(schema.person, eq(schema.person.id, schema.staff.personId))
        .where(where),
    ]);

    // Batch-load roles rather than one query per row.
    const data = await this.attachRoles(this.db, rows);
    return paginated(data, countOf(countRows), page, limit);
  }

  /**
   * `scope` defaults to null (unrestricted) for internal callers that have
   * already checked access — create/update re-read the row they just wrote.
   */
  async findOne(personId: string, scope: string | null = null) {
    return this.findOneWith(this.db, personId, scope);
  }

  /**
   * Takes the connection so a transaction can re-read its own uncommitted
   * writes. Calling the `this.db` version from inside a transaction would run
   * on a different pooled connection and return pre-update data.
   */
  private async findOneWith(
    db: Database | Transaction,
    personId: string,
    scope: string | null = null,
  ) {
    const [row] = await db
      .select({
        personId: schema.staff.personId,
        staffCode: schema.staff.staffCode,
        jobTitleId: schema.staff.jobTitleId,
        jobTitle: schema.jobTitles.name,
        employmentStatus: schema.staff.employmentStatus,
        dataScope: schema.staff.dataScope,
        hiredOn: schema.staff.hiredOn,
        terminatedOn: schema.staff.terminatedOn,
        firstName: schema.person.firstName,
        lastName: schema.person.lastName,
        phone: schema.person.phone,
        dateOfBirth: schema.person.dateOfBirth,
        gender: schema.person.gender,
        status: schema.accounts.status,
        hasAccount: sql<boolean>`${schema.accounts.id} is not null`,
        lastLoginAt: schema.accounts.lastLoginAt,
        branchId: schema.branches.id,
        branchName: schema.branches.name,
        createdAt: schema.staff.createdAt,
        updatedAt: schema.staff.updatedAt,
      })
      .from(schema.staff)
      .innerJoin(schema.person, eq(schema.person.id, schema.staff.personId))
      .innerJoin(
        schema.jobTitles,
        eq(schema.jobTitles.id, schema.staff.jobTitleId),
      )
      .innerJoin(
        schema.branches,
        eq(schema.branches.id, schema.staff.primaryBranchId),
      )
      .leftJoin(
        schema.accounts,
        eq(schema.accounts.personId, schema.staff.personId),
      )
      .where(
        and(
          eq(schema.staff.personId, personId),
          isNull(schema.person.deletedAt),
        ),
      );

    if (!row) {
      throw new NotFoundException('Staff member not found');
    }
    // 404 rather than 403, so the endpoint cannot be used to discover which
    // ids exist at other branches.
    assertInScope(scope, row.branchId, 'Staff member not found');

    const [withRoles] = await this.attachRoles(db, [row]);
    return withRoles;
  }

  /**
   * person -> (accounts, only if a password was given) -> staff -> account_roles,
   * all or nothing.
   *
   * Omitting the password is how a non-login employee is created: no accounts
   * row means no credential exists, so there is nothing to authenticate against.
   */
  async create(dto: CreateStaffDto, scope: string | null) {
    // Escalation guards: a branch-scoped creator may not staff another branch,
    // nor mint someone who outranks them.
    assertCanWriteToBranch(scope, dto.primaryBranchId);
    assertCanGrantScope(scope, dto.dataScope);

    const jobTitle = await this.loadGrantableJobTitle(
      dto.jobTitleId,
      Boolean(dto.password),
    );

    if (!dto.password && dto.roleIds?.length) {
      throw new BadRequestException(
        `Roles are held by an account, so ${jobTitle.name} cannot be given roles without system access`,
      );
    }

    const [phoneTaken] = await this.db
      .select({ id: schema.person.id })
      .from(schema.person)
      .where(
        and(
          eq(schema.person.phone, dto.phone),
          isNull(schema.person.deletedAt),
        ),
      );
    if (phoneTaken) {
      throw new ConflictException(
        'A person with this phone number already exists',
      );
    }

    const passwordHash = dto.password
      ? await bcrypt.hash(dto.password, BCRYPT_ROUNDS)
      : null;

    try {
      return await this.db.transaction(async (tx) => {
        const [created] = await tx
          .insert(schema.person)
          .values({
            firstName: dto.firstName,
            lastName: dto.lastName,
            phone: dto.phone,
            dateOfBirth: dto.dateOfBirth,
            gender: dto.gender,
          })
          .returning();

        let accountId: string | null = null;
        if (passwordHash) {
          const [account] = await tx
            .insert(schema.accounts)
            .values({ personId: created.id, passwordHash })
            .returning({ id: schema.accounts.id });
          accountId = account.id;
        }

        const [staff] = await tx
          .insert(schema.staff)
          .values({
            personId: created.id,
            // System-generated: drawn from a sequence inside this transaction,
            // never supplied by the client.
            staffCode: await nextStaffCode(tx),
            primaryBranchId: dto.primaryBranchId,
            dataScope: dto.dataScope,
            jobTitleId: dto.jobTitleId,
            hiredOn: dto.hiredOn,
          })
          .returning();

        if (accountId && dto.roleIds?.length) {
          await tx
            .insert(schema.accountRoles)
            .values(dto.roleIds.map((roleId) => ({ accountId, roleId })));
        }

        return staff;
      });
    } catch (error) {
      // The pre-check above catches the common case with a friendly message;
      // this catches the race the pre-check cannot, and turns a raw Postgres
      // error into the right status.
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          'A person with this phone number already exists',
        );
      }
      throw error;
    }
  }

  async update(personId: string, dto: UpdateStaffDto, scope: string | null) {
    // 404s if the target sits at another branch.
    const current = await this.findOne(personId, scope);
    if (dto.primaryBranchId) {
      assertCanWriteToBranch(scope, dto.primaryBranchId);
    }
    assertCanGrantScope(scope, dto.dataScope);

    if (dto.jobTitleId) {
      // Changing to a title that cannot hold an account, while an account
      // exists, would leave a login the job title forbids.
      await this.loadGrantableJobTitle(dto.jobTitleId, current.hasAccount);
    }

    const { roleIds, firstName, lastName, dateOfBirth, gender, ...profile } =
      dto;

    return this.db.transaction(async (tx) => {
      if (firstName || lastName || dateOfBirth || gender) {
        await tx
          .update(schema.person)
          .set({ firstName, lastName, dateOfBirth, gender })
          .where(eq(schema.person.id, personId));
      }

      if (Object.keys(profile).length > 0) {
        await tx
          .update(schema.staff)
          .set({
            ...profile,
            // Terminating stamps the date; un-terminating clears it.
            terminatedOn:
              profile.employmentStatus === 'terminated'
                ? new Date().toISOString().slice(0, 10)
                : profile.employmentStatus
                  ? null
                  : undefined,
          })
          .where(eq(schema.staff.personId, personId));
      }

      if (roleIds) {
        const [account] = await tx
          .select({ id: schema.accounts.id })
          .from(schema.accounts)
          .where(eq(schema.accounts.personId, personId));

        if (!account) {
          throw new BadRequestException(
            'This staff member has no system access, so they cannot hold roles',
          );
        }

        await tx
          .delete(schema.accountRoles)
          .where(eq(schema.accountRoles.accountId, account.id));
        if (roleIds.length > 0) {
          await tx
            .insert(schema.accountRoles)
            .values(
              roleIds.map((roleId) => ({ accountId: account.id, roleId })),
            );
        }
      }

      // The access token is a snapshot of roles, branch and scope alike, so
      // any of the three changing leaves a live token over-privileged until it
      // expires. Revoking forces a re-login that mints correct claims.
      if (roleIds || profile.primaryBranchId || profile.dataScope) {
        await tx
          .update(schema.sessions)
          .set({ revokedAt: new Date() })
          .where(
            and(
              eq(schema.sessions.personId, personId),
              eq(schema.sessions.audience, 'staff'),
              isNull(schema.sessions.revokedAt),
            ),
          );
      }

      // Reads through `tx`, so it sees the writes above rather than the row as
      // it was on another pooled connection.
      return this.findOneWith(tx, personId);
    });
  }

  /**
   * Administrative reset for a locked-out staff member — no current password
   * required. Revoking their sessions is the point, not a side effect: whoever
   * was using the old password (them, or someone who should not have had it)
   * is signed out everywhere at once.
   */
  async resetPassword(
    personId: string,
    newPassword: string,
    scope: string | null,
  ): Promise<{ id: string }> {
    // 404s if the target sits at another branch.
    const current = await this.findOne(personId, scope);
    if (!current.hasAccount) {
      throw new BadRequestException(
        'This staff member has no system access. Grant access instead of resetting a password.',
      );
    }

    const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

    return this.db.transaction(async (tx) => {
      await tx
        .update(schema.accounts)
        .set({ passwordHash })
        .where(eq(schema.accounts.personId, personId));

      await tx
        .update(schema.sessions)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(schema.sessions.personId, personId),
            eq(schema.sessions.audience, 'staff'),
            isNull(schema.sessions.revokedAt),
          ),
        );

      return { id: personId };
    });
  }

  /**
   * Give an existing employee a login. Separate from resetPassword on purpose:
   * helping someone locked out and handing someone system access for the first
   * time are different acts, and carry different permissions.
   */
  async grantAccess(
    personId: string,
    dto: GrantStaffAccessDto,
    scope: string | null,
  ): Promise<{ id: string }> {
    const current = await this.findOne(personId, scope);
    if (current.hasAccount) {
      throw new ConflictException('This staff member already has system access');
    }
    if (current.employmentStatus === 'terminated') {
      throw new BadRequestException('Terminated staff cannot be given access');
    }
    await this.loadGrantableJobTitle(current.jobTitleId, true);

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    // Two tables now that roles come with the account, so one transaction:
    // an account created without its roles is someone who can sign in and do
    // nothing, and nobody would notice until they complained.
    return this.db.transaction(async (tx) => {
      const [account] = await tx
        .insert(schema.accounts)
        .values({ personId, passwordHash })
        .returning({ id: schema.accounts.id });

      if (dto.roleIds?.length) {
        await tx
          .insert(schema.accountRoles)
          .values(
            dto.roleIds.map((roleId) => ({ accountId: account.id, roleId })),
          );
      }

      return { id: personId };
    });
  }

  /**
   * What a signed-in staff member may reach: their roles, and how far their
   * queries see. Separate from `update` because this is an access decision,
   * not an HR one — it lives on the Users screen and answers to `role.assign`,
   * so someone can manage access without also being able to edit names and job
   * titles.
   *
   * Both fields feed the access token, so changing either revokes their staff
   * sessions: a live token is a snapshot of exactly these.
   */
  async setAuthorization(
    personId: string,
    dto: SetStaffAuthorizationDto,
    scope: string | null,
  ) {
    const current = await this.findOne(personId, scope);
    assertCanGrantScope(scope, dto.dataScope);

    if (!current.hasAccount) {
      throw new BadRequestException(
        'This staff member has no system access, so they have nothing to authorise',
      );
    }

    return this.db.transaction(async (tx) => {
      if (dto.dataScope) {
        await tx
          .update(schema.staff)
          .set({ dataScope: dto.dataScope })
          .where(eq(schema.staff.personId, personId));
      }

      if (dto.roleIds) {
        const [account] = await tx
          .select({ id: schema.accounts.id })
          .from(schema.accounts)
          .where(eq(schema.accounts.personId, personId));

        await tx
          .delete(schema.accountRoles)
          .where(eq(schema.accountRoles.accountId, account.id));
        if (dto.roleIds.length > 0) {
          await tx
            .insert(schema.accountRoles)
            .values(
              dto.roleIds.map((roleId) => ({ accountId: account.id, roleId })),
            );
        }
      }

      await tx
        .update(schema.sessions)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(schema.sessions.personId, personId),
            eq(schema.sessions.audience, 'staff'),
            isNull(schema.sessions.revokedAt),
          ),
        );

      return this.findOneWith(tx, personId);
    });
  }

  /**
   * Switch a login off, or back on, WITHOUT destroying it. The distinction
   * from revokeAccess is the password: disabling keeps it, so re-enabling
   * hands them back the credential they already know. Use this for a temporary
   * lock-out you intend to lift — a suspension pending an investigation —
   * and revoke when access should stop existing.
   *
   * Disabling revokes live sessions too; a valid token would otherwise outlive
   * the decision until it expired.
   */
  async setAccountStatus(
    personId: string,
    status: AccountStatus,
    currentStaffId: string,
    scope: string | null,
  ): Promise<{ id: string }> {
    if (personId === currentStaffId && status === 'disabled') {
      throw new ForbiddenException('You cannot disable your own login');
    }
    const current = await this.findOne(personId, scope);
    if (!current.hasAccount) {
      throw new NotFoundException('This staff member has no system access');
    }

    return this.db.transaction(async (tx) => {
      await tx
        .update(schema.accounts)
        .set({ status })
        .where(eq(schema.accounts.personId, personId));

      if (status === 'disabled') {
        await tx
          .update(schema.sessions)
          .set({ revokedAt: new Date() })
          .where(
            and(
              eq(schema.sessions.personId, personId),
              eq(schema.sessions.audience, 'staff'),
              isNull(schema.sessions.revokedAt),
            ),
          );
      }

      return { id: personId };
    });
  }

  /**
   * Take a login away. A hard delete, not a flag — the account row existing IS
   * the right to sign in, so removing it is the revocation. account_roles
   * cascades with it.
   */
  async revokeAccess(
    personId: string,
    currentStaffId: string,
    scope: string | null,
  ): Promise<{ id: string }> {
    if (personId === currentStaffId) {
      throw new ForbiddenException('You cannot revoke your own system access');
    }
    const current = await this.findOne(personId, scope);
    if (!current.hasAccount) {
      throw new NotFoundException('This staff member has no system access');
    }

    return this.db.transaction(async (tx) => {
      await tx
        .delete(schema.accounts)
        .where(eq(schema.accounts.personId, personId));

      await tx
        .update(schema.sessions)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(schema.sessions.personId, personId),
            eq(schema.sessions.audience, 'staff'),
            isNull(schema.sessions.revokedAt),
          ),
        );

      return { id: personId };
    });
  }

  /** Soft delete on person; the staff row stays so history survives. */
  async remove(personId: string, currentStaffId: string, scope: string | null) {
    if (personId === currentStaffId) {
      throw new ForbiddenException('You cannot delete your own staff account');
    }
    await this.findOne(personId, scope);

    return this.db.transaction(async (tx) => {
      const [deleted] = await tx
        .update(schema.person)
        .set({ deletedAt: new Date() })
        .where(eq(schema.person.id, personId))
        .returning({ id: schema.person.id });

      await tx
        .update(schema.staff)
        .set({
          employmentStatus: 'terminated',
          terminatedOn: new Date().toISOString().slice(0, 10),
        })
        .where(eq(schema.staff.personId, personId));

      // Terminating removes the credential outright, not just the sessions —
      // otherwise a live password outlives the job.
      await tx
        .delete(schema.accounts)
        .where(eq(schema.accounts.personId, personId));

      await tx
        .update(schema.sessions)
        .set({ revokedAt: new Date() })
        .where(
          and(
            eq(schema.sessions.personId, personId),
            eq(schema.sessions.audience, 'staff'),
          ),
        );

      return deleted;
    });
  }

  /**
   * Enforced here rather than only in the UI: without this, curl can still mint
   * credentials for a cleaner.
   */
  private async loadGrantableJobTitle(jobTitleId: string, wantsAccount: boolean) {
    const [jobTitle] = await this.db
      .select()
      .from(schema.jobTitles)
      .where(eq(schema.jobTitles.id, jobTitleId));

    if (!jobTitle) {
      throw new BadRequestException('Job title not found');
    }
    if (wantsAccount && !jobTitle.canHaveAccount) {
      throw new BadRequestException(
        `A ${jobTitle.name} cannot be given system access`,
      );
    }
    return jobTitle;
  }

  private async attachRoles<T extends { personId: string }>(
    db: Database | Transaction,
    rows: T[],
  ) {
    if (rows.length === 0) return [];

    // Roles hang off the account, so this joins back through accounts to reach
    // the person. staffId and personId used to be interchangeable; accountId is
    // a different value entirely.
    const grants = await db
      .select({
        personId: schema.accounts.personId,
        id: schema.roles.id,
        name: schema.roles.name,
      })
      .from(schema.accountRoles)
      .innerJoin(
        schema.accounts,
        eq(schema.accounts.id, schema.accountRoles.accountId),
      )
      .innerJoin(schema.roles, eq(schema.roles.id, schema.accountRoles.roleId))
      .where(
        inArray(
          schema.accounts.personId,
          rows.map((row) => row.personId),
        ),
      );

    const byPerson = new Map<string, { id: string; name: string }[]>();
    for (const grant of grants) {
      const list = byPerson.get(grant.personId) ?? [];
      list.push({ id: grant.id, name: grant.name });
      byPerson.set(grant.personId, list);
    }

    return rows.map((row) => ({
      ...row,
      roles: byPerson.get(row.personId) ?? [],
    }));
  }
}

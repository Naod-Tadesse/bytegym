import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, ilike, isNull, or, sql } from 'drizzle-orm';

import { assertCanWriteToBranch, assertInScope } from '../common/branch-scope';
import { countOf, paginated, toOffset } from '../common/paginate';
import type { PaginationDto } from '../common/pagination.dto';
import { isUniqueViolation } from '../common/pg-errors';
import type { Database, Transaction } from '../database/database.client';
import { DRIZZLE } from '../database/database.constants';
import { nextMemberCode } from '../database/member-code';
import { membershipStatusOf } from '../database/membership-status';
import * as schema from '../database/schema';
import type { CreateMemberDto, UpdateMemberDto } from './dto/member.dto';

const PHONE_TAKEN = 'A person with this phone number already exists';

const membershipStatus = membershipStatusOf(schema.member.personId);

/**
 * The last day covered by any membership, or null if there has never been one.
 *
 * `max(ends_on)` rather than the current period's, so an early renewal reads as
 * the date cover actually runs out — "active until 30 Nov" is what the
 * receptionist needs, not the end of the period they happen to be in.
 */
const expiresOn = sql<string | null>`(
  select max(m.ends_on) from ${schema.memberships} m
  where m.member_id = ${schema.member.personId} and m.deleted_at is null)`;

/** What GET /members rows carry. Kept in step with MemberListItemDto by hand. */
const listColumns = {
  personId: schema.member.personId,
  memberCode: schema.member.memberCode,
  firstName: schema.person.firstName,
  lastName: schema.person.lastName,
  phone: schema.person.phone,
  dateOfBirth: schema.person.dateOfBirth,
  gender: schema.person.gender,
  branchId: schema.member.branchId,
  branchName: schema.branches.name,
  isSuspended: schema.member.isSuspended,
  // Derived per request. On the list as well as the detail: the front desk
  // reads it off the row, and fetching the detail per member would be an N+1.
  membershipStatus,
  expiresOn,
  createdAt: schema.member.createdAt,
};

/** GET /members/{id} — the list row plus what only the detail shows. */
const detailColumns = {
  ...listColumns,
  emergencyContactName: schema.member.emergencyContactName,
  emergencyContactPhone: schema.member.emergencyContactPhone,
  updatedAt: schema.member.updatedAt,
};

@Injectable()
export class MembersService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async findAll(query: PaginationDto, scope: string | null) {
    const { page, limit, offset } = toOffset(query.page, query.limit);

    // The member row survives a delete; person.deletedAt is the soft-delete
    // flag, so that is what a read filters on.
    const conditions = [isNull(schema.person.deletedAt)];
    // `null` scope means every branch — see branchScopeOf.
    if (scope) {
      conditions.push(eq(schema.member.branchId, scope));
    }
    if (query.search) {
      const term = `%${query.search}%`;
      const match = or(
        ilike(schema.person.firstName, term),
        ilike(schema.person.lastName, term),
        ilike(schema.person.phone, term),
        ilike(schema.member.memberCode, term),
      );
      if (match) conditions.push(match);
    }
    const where = and(...conditions);

    const [data, countRows] = await Promise.all([
      this.db
        .select(listColumns)
        .from(schema.member)
        .innerJoin(schema.person, eq(schema.person.id, schema.member.personId))
        .innerJoin(
          schema.branches,
          eq(schema.branches.id, schema.member.branchId),
        )
        .where(where)
        .limit(limit)
        .offset(offset)
        .orderBy(schema.member.createdAt),
      // No branches join: nothing in `where` refers to it, so the count query
      // can reuse the same conditions unchanged.
      this.db
        .select({ count: sql<number>`count(*)` })
        .from(schema.member)
        .innerJoin(schema.person, eq(schema.person.id, schema.member.personId))
        .where(where),
    ]);

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
      .select(detailColumns)
      .from(schema.member)
      .innerJoin(schema.person, eq(schema.person.id, schema.member.personId))
      .innerJoin(
        schema.branches,
        eq(schema.branches.id, schema.member.branchId),
      )
      .where(
        and(
          eq(schema.member.personId, personId),
          isNull(schema.person.deletedAt),
        ),
      );

    if (!row) {
      throw new NotFoundException('Member not found');
    }
    // 404 rather than 403, so the endpoint cannot be used to discover which
    // ids exist at other branches.
    assertInScope(scope, row.branchId, 'Member not found');

    return row;
  }

  /**
   * person -> member, all or nothing. A member is a person with a member row;
   * a person written without one would be a ghost nothing lists.
   *
   * Registering someone who already exists as staff 409s today — linking an
   * existing person is a later endpoint, not a silent second person row.
   */
  async create(dto: CreateMemberDto, scope: string | null) {
    // The caller supplied this branch id, so Forbidden rather than 404 —
    // there is nothing to conceal.
    assertCanWriteToBranch(scope, dto.branchId);

    // Friendly pre-check for the common case; the partial unique index on
    // person.phone is the actual guard.
    const [taken] = await this.db
      .select({ id: schema.person.id })
      .from(schema.person)
      .where(
        and(
          eq(schema.person.phone, dto.phone),
          isNull(schema.person.deletedAt),
        ),
      );
    if (taken) {
      throw new ConflictException(PHONE_TAKEN);
    }

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
          .returning({ id: schema.person.id });

        await tx.insert(schema.member).values({
          personId: created.id,
          // System-generated: drawn from a sequence inside this transaction,
          // never supplied by the client.
          memberCode: await nextMemberCode(tx),
          branchId: dto.branchId,
          emergencyContactName: dto.emergencyContactName,
          emergencyContactPhone: dto.emergencyContactPhone,
        });

        // Reads through `tx`, so it sees the two inserts above.
        return this.findOneWith(tx, created.id);
      });
    } catch (error) {
      // The pre-check above catches the common case with a friendly message;
      // this catches the race it cannot, and turns a raw Postgres error into
      // the right status.
      if (isUniqueViolation(error)) {
        throw new ConflictException(PHONE_TAKEN);
      }
      throw error;
    }
  }

  /** Phone is immutable here, exactly as it is on staff. */
  async update(personId: string, dto: UpdateMemberDto, scope: string | null) {
    // 404s if the member sits at another branch.
    await this.findOne(personId, scope);
    if (dto.branchId) {
      // Stops a branch-scoped caller moving someone into, or out of, a branch
      // that is not theirs.
      assertCanWriteToBranch(scope, dto.branchId);
    }

    const { firstName, lastName, dateOfBirth, gender, ...profile } = dto;

    return this.db.transaction(async (tx) => {
      if (
        firstName !== undefined ||
        lastName !== undefined ||
        dateOfBirth !== undefined ||
        gender !== undefined
      ) {
        await tx
          .update(schema.person)
          .set({ firstName, lastName, dateOfBirth, gender })
          .where(eq(schema.person.id, personId));
      }

      if (Object.keys(profile).length > 0) {
        await tx
          .update(schema.member)
          .set(profile)
          .where(eq(schema.member.personId, personId));
      }

      return this.findOneWith(tx, personId);
    });
  }

  /**
   * Barring someone from the premises, or lifting it. Its own endpoint because
   * it is a decision rather than an edit — and because PATCH /:id echoing a
   * whole form back would otherwise flip it by accident.
   */
  async setSuspension(
    personId: string,
    isSuspended: boolean,
    scope: string | null,
  ) {
    // 404s if the member sits at another branch.
    await this.findOne(personId, scope);

    // One table, one statement — already atomic, so no transaction.
    await this.db
      .update(schema.member)
      .set({ isSuspended })
      .where(eq(schema.member.personId, personId));

    return this.findOne(personId);
  }

  /**
   * Soft delete on person; the member row stays, so memberships, payments and
   * check-ins still resolve to a name.
   */
  async remove(
    personId: string,
    scope: string | null,
  ): Promise<{ id: string }> {
    await this.findOne(personId, scope);

    const [deleted] = await this.db
      .update(schema.person)
      .set({ deletedAt: new Date() })
      .where(eq(schema.person.id, personId))
      .returning({ id: schema.person.id });

    return deleted;
  }
}

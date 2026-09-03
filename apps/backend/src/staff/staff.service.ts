import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { and, eq, ilike, inArray, isNull, or, sql } from 'drizzle-orm';

import { countOf, paginated, toOffset } from '../common/paginate';
import type { PaginationDto } from '../common/pagination.dto';
import type { Database } from '../database/database.client';
import { DRIZZLE } from '../database/database.constants';
import * as schema from '../database/schema';
import type { CreateStaffDto, UpdateStaffDto } from './dto/staff.dto';

const BCRYPT_ROUNDS = 10;

@Injectable()
export class StaffService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async findAll(query: PaginationDto) {
    const { page, limit, offset } = toOffset(query.page, query.limit);

    const conditions = [isNull(schema.users.deletedAt)];
    if (query.search) {
      const term = `%${query.search}%`;
      const match = or(
        ilike(schema.users.firstName, term),
        ilike(schema.users.lastName, term),
        ilike(schema.users.phone, term),
        ilike(schema.staffProfiles.staffCode, term),
      );
      if (match) conditions.push(match);
    }
    const where = and(...conditions);

    const columns = {
      userId: schema.staffProfiles.userId,
      staffCode: schema.staffProfiles.staffCode,
      jobTitle: schema.staffProfiles.jobTitle,
      employmentStatus: schema.staffProfiles.employmentStatus,
      hiredOn: schema.staffProfiles.hiredOn,
      firstName: schema.users.firstName,
      lastName: schema.users.lastName,
      phone: schema.users.phone,
      status: schema.users.status,
      branchId: schema.branches.id,
      branchName: schema.branches.name,
      createdAt: schema.staffProfiles.createdAt,
    };

    const [rows, countRows] = await Promise.all([
      this.db
        .select(columns)
        .from(schema.staffProfiles)
        .innerJoin(
          schema.users,
          eq(schema.users.id, schema.staffProfiles.userId),
        )
        .innerJoin(
          schema.branches,
          eq(schema.branches.id, schema.staffProfiles.primaryBranchId),
        )
        .where(where)
        .limit(limit)
        .offset(offset)
        .orderBy(schema.staffProfiles.createdAt),
      this.db
        .select({ count: sql<number>`count(*)` })
        .from(schema.staffProfiles)
        .innerJoin(
          schema.users,
          eq(schema.users.id, schema.staffProfiles.userId),
        )
        .where(where),
    ]);

    // Batch-load roles rather than one query per row.
    const data = await this.attachRoles(rows);
    return paginated(data, countOf(countRows), page, limit);
  }

  async findOne(userId: string) {
    const [row] = await this.db
      .select({
        userId: schema.staffProfiles.userId,
        staffCode: schema.staffProfiles.staffCode,
        jobTitle: schema.staffProfiles.jobTitle,
        employmentStatus: schema.staffProfiles.employmentStatus,
        hiredOn: schema.staffProfiles.hiredOn,
        terminatedOn: schema.staffProfiles.terminatedOn,
        firstName: schema.users.firstName,
        lastName: schema.users.lastName,
        phone: schema.users.phone,
        dateOfBirth: schema.users.dateOfBirth,
        gender: schema.users.gender,
        status: schema.users.status,
        lastLoginAt: schema.users.lastLoginAt,
        branchId: schema.branches.id,
        branchName: schema.branches.name,
        createdAt: schema.staffProfiles.createdAt,
        updatedAt: schema.staffProfiles.updatedAt,
      })
      .from(schema.staffProfiles)
      .innerJoin(schema.users, eq(schema.users.id, schema.staffProfiles.userId))
      .innerJoin(
        schema.branches,
        eq(schema.branches.id, schema.staffProfiles.primaryBranchId),
      )
      .where(
        and(
          eq(schema.staffProfiles.userId, userId),
          isNull(schema.users.deletedAt),
        ),
      );

    if (!row) {
      throw new NotFoundException('Staff member not found');
    }

    const [withRoles] = await this.attachRoles([row]);
    return withRoles;
  }

  /** users -> staff_profiles -> user_roles, all or nothing. */
  async create(dto: CreateStaffDto) {
    const [phoneTaken] = await this.db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(
        and(eq(schema.users.phone, dto.phone), isNull(schema.users.deletedAt)),
      );
    if (phoneTaken) {
      throw new ConflictException(
        'A user with this phone number already exists',
      );
    }

    const [codeTaken] = await this.db
      .select({ userId: schema.staffProfiles.userId })
      .from(schema.staffProfiles)
      .where(eq(schema.staffProfiles.staffCode, dto.staffCode));
    if (codeTaken) {
      throw new ConflictException(
        'A staff member with this code already exists',
      );
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    return this.db.transaction(async (tx) => {
      const [user] = await tx
        .insert(schema.users)
        .values({
          firstName: dto.firstName,
          lastName: dto.lastName,
          phone: dto.phone,
          passwordHash,
          dateOfBirth: dto.dateOfBirth,
          gender: dto.gender,
        })
        .returning();

      const [staff] = await tx
        .insert(schema.staffProfiles)
        .values({
          userId: user.id,
          staffCode: dto.staffCode,
          primaryBranchId: dto.primaryBranchId,
          jobTitle: dto.jobTitle,
          hiredOn: dto.hiredOn,
        })
        .returning();

      if (dto.roleIds?.length) {
        await tx
          .insert(schema.userRoles)
          .values(
            dto.roleIds.map((roleId) => ({ staffId: staff.userId, roleId })),
          );
      }

      return staff;
    });
  }

  async update(userId: string, dto: UpdateStaffDto) {
    await this.findOne(userId);
    const { roleIds, firstName, lastName, dateOfBirth, gender, ...profile } =
      dto;

    return this.db.transaction(async (tx) => {
      if (firstName || lastName || dateOfBirth || gender) {
        await tx
          .update(schema.users)
          .set({ firstName, lastName, dateOfBirth, gender })
          .where(eq(schema.users.id, userId));
      }

      if (Object.keys(profile).length > 0) {
        await tx
          .update(schema.staffProfiles)
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
          .where(eq(schema.staffProfiles.userId, userId));
      }

      if (roleIds) {
        await tx
          .delete(schema.userRoles)
          .where(eq(schema.userRoles.staffId, userId));
        if (roleIds.length > 0) {
          await tx
            .insert(schema.userRoles)
            .values(roleIds.map((roleId) => ({ staffId: userId, roleId })));
        }
        // Their token still carries the old permissions — force a re-login.
        await tx
          .update(schema.sessions)
          .set({ revokedAt: new Date() })
          .where(
            and(
              eq(schema.sessions.userId, userId),
              isNull(schema.sessions.revokedAt),
            ),
          );
      }

      return this.findOne(userId);
    });
  }

  /** Soft delete on users; the staff_profiles row stays so history survives. */
  async remove(userId: string, currentStaffId: string) {
    if (userId === currentStaffId) {
      throw new ForbiddenException('You cannot delete your own staff account');
    }
    await this.findOne(userId);

    return this.db.transaction(async (tx) => {
      const [user] = await tx
        .update(schema.users)
        .set({ deletedAt: new Date() })
        .where(eq(schema.users.id, userId))
        .returning({ id: schema.users.id });

      await tx
        .update(schema.staffProfiles)
        .set({
          employmentStatus: 'terminated',
          terminatedOn: new Date().toISOString().slice(0, 10),
        })
        .where(eq(schema.staffProfiles.userId, userId));

      await tx
        .update(schema.sessions)
        .set({ revokedAt: new Date() })
        .where(eq(schema.sessions.userId, userId));

      return user;
    });
  }

  private async attachRoles<T extends { userId: string }>(rows: T[]) {
    if (rows.length === 0) return [];

    const grants = await this.db
      .select({
        staffId: schema.userRoles.staffId,
        id: schema.roles.id,
        name: schema.roles.name,
      })
      .from(schema.userRoles)
      .innerJoin(schema.roles, eq(schema.roles.id, schema.userRoles.roleId))
      .where(
        inArray(
          schema.userRoles.staffId,
          rows.map((row) => row.userId),
        ),
      );

    const byStaff = new Map<string, { id: string; name: string }[]>();
    for (const grant of grants) {
      const list = byStaff.get(grant.staffId) ?? [];
      list.push({ id: grant.id, name: grant.name });
      byStaff.set(grant.staffId, list);
    }

    return rows.map((row) => ({
      ...row,
      roles: byStaff.get(row.userId) ?? [],
    }));
  }
}

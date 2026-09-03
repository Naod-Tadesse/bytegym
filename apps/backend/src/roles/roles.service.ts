import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, ilike, inArray, isNull, ne, sql } from 'drizzle-orm';

import { countOf, paginated, toOffset } from '../common/paginate';
import type { PaginationDto } from '../common/pagination.dto';
import type { Database } from '../database/database.client';
import { DRIZZLE } from '../database/database.constants';
import * as schema from '../database/schema';
import type { CreateRoleDto, UpdateRoleDto } from './dto/role.dto';

@Injectable()
export class RolesService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async findAll(query: PaginationDto) {
    const { page, limit, offset } = toOffset(query.page, query.limit);

    const conditions = [isNull(schema.roles.deletedAt)];
    if (query.search) {
      conditions.push(ilike(schema.roles.name, `%${query.search}%`));
    }
    const where = and(...conditions);

    const [data, countRows] = await Promise.all([
      this.db
        .select()
        .from(schema.roles)
        .where(where)
        .limit(limit)
        .offset(offset)
        .orderBy(schema.roles.createdAt),
      this.db
        .select({ count: sql<number>`count(*)` })
        .from(schema.roles)
        .where(where),
    ]);

    return paginated(data, countOf(countRows), page, limit);
  }

  /** Returns the role with its permissions attached. */
  async findOne(id: string) {
    const [role] = await this.db
      .select()
      .from(schema.roles)
      .where(and(eq(schema.roles.id, id), isNull(schema.roles.deletedAt)));

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    const permissions = await this.db
      .select({
        id: schema.permissions.id,
        name: schema.permissions.name,
        displayName: schema.permissions.displayName,
        description: schema.permissions.description,
        group: schema.permissions.group,
      })
      .from(schema.rolePermissions)
      .innerJoin(
        schema.permissions,
        eq(schema.permissions.id, schema.rolePermissions.permissionId),
      )
      .where(eq(schema.rolePermissions.roleId, id));

    return { ...role, permissions };
  }

  async create(dto: CreateRoleDto) {
    await this.assertNameUnique(dto.name);

    const [role] = await this.db.insert(schema.roles).values(dto).returning();
    return role;
  }

  async update(id: string, dto: UpdateRoleDto) {
    await this.findOne(id);
    if (dto.name) {
      await this.assertNameUnique(dto.name, id);
    }

    const [role] = await this.db
      .update(schema.roles)
      .set(dto)
      .where(and(eq(schema.roles.id, id), isNull(schema.roles.deletedAt)))
      .returning();
    return role;
  }

  /**
   * Soft delete. Detaching user_roles in the same transaction matters: without
   * it a staff member keeps a dangling grant, and their live access token still
   * carries permissions from a role that no longer exists — so we also revoke
   * their sessions, forcing a re-login that reissues a correct token.
   */
  async remove(id: string) {
    await this.findOne(id);

    const affected = await this.db
      .select({ staffId: schema.userRoles.staffId })
      .from(schema.userRoles)
      .where(eq(schema.userRoles.roleId, id));

    const role = await this.db.transaction(async (tx) => {
      await tx.delete(schema.userRoles).where(eq(schema.userRoles.roleId, id));

      const [deleted] = await tx
        .update(schema.roles)
        .set({ deletedAt: new Date() })
        .where(eq(schema.roles.id, id))
        .returning();

      if (affected.length > 0) {
        await tx
          .update(schema.sessions)
          .set({ revokedAt: new Date() })
          .where(
            and(
              inArray(
                schema.sessions.userId,
                affected.map((row) => row.staffId),
              ),
              isNull(schema.sessions.revokedAt),
            ),
          );
      }

      return deleted;
    });

    return role;
  }

  async listPermissions() {
    return this.db
      .select()
      .from(schema.permissions)
      .orderBy(schema.permissions.group, schema.permissions.name);
  }

  /**
   * Diff-based sync, not delete-all-then-reinsert: untouched grants keep their
   * original created_at, and the write is proportional to what actually changed.
   */
  async syncPermissions(roleId: string, permissionIds: string[]) {
    await this.findOne(roleId);

    return this.db.transaction(async (tx) => {
      const current = await tx
        .select({ permissionId: schema.rolePermissions.permissionId })
        .from(schema.rolePermissions)
        .where(eq(schema.rolePermissions.roleId, roleId));

      const currentIds = new Set(current.map((row) => row.permissionId));
      const desiredIds = new Set(permissionIds);

      const toAdd = permissionIds.filter((id) => !currentIds.has(id));
      const toRemove = current
        .map((row) => row.permissionId)
        .filter((id) => !desiredIds.has(id));

      if (toRemove.length > 0) {
        await tx
          .delete(schema.rolePermissions)
          .where(
            and(
              eq(schema.rolePermissions.roleId, roleId),
              inArray(schema.rolePermissions.permissionId, toRemove),
            ),
          );
      }

      if (toAdd.length > 0) {
        await tx
          .insert(schema.rolePermissions)
          .values(toAdd.map((permissionId) => ({ roleId, permissionId })));
      }

      return { added: toAdd.length, removed: toRemove.length };
    });
  }

  private async assertNameUnique(name: string, excludeId?: string) {
    const conditions = [
      isNull(schema.roles.deletedAt),
      // lower() not ilike — `_` is a LIKE wildcard.
      sql`lower(${schema.roles.name}) = lower(${name})`,
    ];
    if (excludeId) {
      conditions.push(ne(schema.roles.id, excludeId));
    }

    const [dupe] = await this.db
      .select({ id: schema.roles.id })
      .from(schema.roles)
      .where(and(...conditions));

    if (dupe) {
      throw new ConflictException('A role with this name already exists');
    }
  }
}

import { pgTable, primaryKey, uuid } from 'drizzle-orm/pg-core';

import { permissions } from './permissions';
import { roles } from './roles';

/**
 * Composite PK, no surrogate id. Granting the same permission twice is
 * meaningless, so the PK is the constraint.
 */
export const rolePermissions = pgTable(
  'role_permissions',
  {
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    permissionId: uuid('permission_id')
      .notNull()
      .references(() => permissions.id, { onDelete: 'cascade' }),
  },
  (table) => [
    primaryKey({
      name: 'role_permissions_pk',
      columns: [table.roleId, table.permissionId],
    }),
  ],
);

export type RolePermission = typeof rolePermissions.$inferSelect;
export type NewRolePermission = typeof rolePermissions.$inferInsert;

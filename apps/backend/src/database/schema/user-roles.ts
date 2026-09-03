import { pgTable, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { roles } from './roles';
import { staffProfiles } from './staff-profiles';

/**
 * Roles are gym-wide. Branch scoping was deliberately dropped: a role applies
 * everywhere the staff member works, and which branch that is comes from
 * staff_profiles.primaryBranchId. Revoking is a delete.
 *
 * staffId points at staff_profiles rather than users, so a member cannot be
 * granted a role — enforced by the FK rather than by app code.
 */
export const userRoles = pgTable(
  'user_roles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    staffId: uuid('staff_id')
      .notNull()
      .references(() => staffProfiles.userId, { onDelete: 'cascade' }),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('user_roles_staff_role_uniq').on(table.staffId, table.roleId),
  ],
);

export type UserRole = typeof userRoles.$inferSelect;
export type NewUserRole = typeof userRoles.$inferInsert;

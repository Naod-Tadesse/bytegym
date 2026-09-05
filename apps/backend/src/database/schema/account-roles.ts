import { pgTable, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

import { accounts } from './accounts';
import { roles } from './roles';

/**
 * Roles are gym-wide. Branch scoping was deliberately dropped: a role applies
 * everywhere the staff member works, and which branch that is comes from
 * staff.primaryBranchId. Revoking is a delete.
 *
 * accountId points at accounts rather than staff, so only someone who can
 * actually sign in may hold a role — enforced by the FK rather than by app
 * code. A cleaner has no account, so there is nothing to hang a role on.
 *
 * ON DELETE CASCADE is the point of the design: revoking access deletes the
 * account row, and the grants go with it in the same statement.
 */
export const accountRoles = pgTable(
  'account_roles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    accountId: uuid('account_id')
      .notNull()
      .references(() => accounts.id, { onDelete: 'cascade' }),
    roleId: uuid('role_id')
      .notNull()
      .references(() => roles.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex('account_roles_account_role_uniq').on(
      table.accountId,
      table.roleId,
    ),
  ],
);

export type AccountRole = typeof accountRoles.$inferSelect;
export type NewAccountRole = typeof accountRoles.$inferInsert;

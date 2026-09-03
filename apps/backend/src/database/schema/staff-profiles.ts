import { sql } from 'drizzle-orm';
import {
  date,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { branches } from './branches';
import { users } from './users';

export const employmentStatus = pgEnum('employment_status', [
  'active',
  'on_leave',
  'terminated',
]);

/**
 * The existence of this row is what makes someone staff. Terminated staff keep
 * the row so history survives — firing someone must not touch users.status.
 */
export const staffProfiles = pgTable(
  'staff_profiles',
  {
    userId: uuid('user_id')
      .primaryKey()
      .references(() => users.id),
    staffCode: varchar('staff_code', { length: 24 }).notNull(),
    primaryBranchId: uuid('primary_branch_id')
      .notNull()
      .references(() => branches.id),
    /** Display label only — permissions come from roles. */
    jobTitle: varchar('job_title', { length: 80 }).notNull(),
    employmentStatus: employmentStatus('employment_status')
      .notNull()
      .default('active'),
    hiredOn: date('hired_on').notNull(),
    terminatedOn: date('terminated_on'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('staff_profiles_code_uniq').on(table.staffCode),
    uniqueIndex('staff_profiles_active_branch_idx')
      .on(table.primaryBranchId, table.userId)
      .where(sql`${table.terminatedOn} is null`),
  ],
);

export type StaffProfile = typeof staffProfiles.$inferSelect;
export type NewStaffProfile = typeof staffProfiles.$inferInsert;

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
 * How much of the gym this person's queries can reach.
 *
 * `branch` — everything is filtered to `primary_branch_id`.
 * `all`    — no branch filter at all; owners and general managers.
 *
 * Declared explicitly and defaulting to the narrower value, rather than
 * inferring "sees everything" from a null branch: a bug that fails to set this
 * grants too little access, never too much.
 */
export const dataScope = pgEnum('data_scope', ['branch', 'all']);

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
    /** Where they are based. Still required, even at `all` scope. */
    primaryBranchId: uuid('primary_branch_id')
      .notNull()
      .references(() => branches.id),
    dataScope: dataScope('data_scope').notNull().default('branch'),
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

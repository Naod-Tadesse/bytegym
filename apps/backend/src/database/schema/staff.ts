import { sql } from 'drizzle-orm';
import {
  date,
  pgEnum,
  pgSequence,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { branches } from './branches';
import { jobTitles } from './job-titles';
import { person } from './person';

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
 * Feeds the generated staff code. A sequence rather than `max(...) + 1`
 * because nextval is atomic — two concurrent hires cannot draw the same
 * number, so there is no race to retry and no unique-violation to translate.
 *
 * Gaps are expected and fine: a rolled-back transaction consumes a number.
 * The code identifies a person, it does not count them.
 */
export const staffCodeSeq = pgSequence('staff_code_seq', { startWith: 1 });

/**
 * The existence of this row is what makes someone staff. Terminated staff keep
 * the row so history survives — firing someone must not touch person.status.
 */
export const staff = pgTable(
  'staff',
  {
    personId: uuid('person_id')
      .primaryKey()
      .references(() => person.id),
    staffCode: varchar('staff_code', { length: 24 }).notNull(),
    /** Where they are based. Still required, even at `all` scope. */
    primaryBranchId: uuid('primary_branch_id')
      .notNull()
      .references(() => branches.id),
    dataScope: dataScope('data_scope').notNull().default('branch'),
    /**
     * What they do. Permissions still come from roles — this only decides
     * whether they may hold an account at all, via jobTitles.canHaveAccount.
     */
    jobTitleId: uuid('job_title_id')
      .notNull()
      .references(() => jobTitles.id),
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
    uniqueIndex('staff_code_uniq').on(table.staffCode),
    uniqueIndex('staff_active_branch_idx')
      .on(table.primaryBranchId, table.personId)
      .where(sql`${table.terminatedOn} is null`),
  ],
);

export type Staff = typeof staff.$inferSelect;
export type NewStaff = typeof staff.$inferInsert;

import {
  boolean,
  index,
  pgSequence,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { branches } from './branches';
import { person } from './person';

/**
 * Feeds the generated member code, exactly as staffCodeSeq feeds the staff one.
 * `nextval` is atomic, so two receptionists registering at once cannot draw the
 * same number — no pre-check, no race to retry.
 *
 * Gaps are expected: a rolled-back registration consumes a number. The code
 * identifies a member, it does not count them.
 */
export const memberCodeSeq = pgSequence('member_code_seq', { startWith: 1 });

/**
 * The existence of this row is what makes someone a member — there is no
 * `member` role and no person_type column.
 *
 * No `deleted_at` of its own: removing a member soft-deletes the *person* and
 * leaves this row in place, so their memberships, payments and check-ins still
 * resolve. Every read therefore filters `isNull(person.deletedAt)`, not a
 * column here.
 */
export const member = pgTable(
  'member',
  {
    personId: uuid('person_id')
      .primaryKey()
      .references(() => person.id),
    memberCode: varchar('member_code', { length: 24 }).notNull(),
    /** Their home gym. The column every branch-scoped query filters on. */
    branchId: uuid('branch_id')
      .notNull()
      .references(() => branches.id),
    /**
     * Barred from the premises. Deliberately independent of whether they have
     * paid: an expired membership is derived from the memberships table, while
     * this is a decision someone made about them.
     */
    isSuspended: boolean('is_suspended').notNull().default(false),
    emergencyContactName: varchar('emergency_contact_name', { length: 120 }),
    emergencyContactPhone: varchar('emergency_contact_phone', { length: 30 }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    // A plain unique index, not a partial one: the code is drawn from a
    // sequence and never reused, and the row outlives the person's soft delete.
    uniqueIndex('member_code_uniq').on(table.memberCode),
    index('member_branch_idx').on(table.branchId),
  ],
);

export type Member = typeof member.$inferSelect;
export type NewMember = typeof member.$inferInsert;

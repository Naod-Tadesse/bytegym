import { sql } from 'drizzle-orm';
import {
  boolean,
  date,
  index,
  numeric,
  pgTable,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

import { member } from './member';
import { membershipPlans } from './membership-plans';
import { staff } from './staff';

/**
 * One row per period of cover sold to a member. The table the whole gym runs
 * on: whether someone may train today is `current_date between starts_on and
 * ends_on` on a row here, never a stored flag anywhere.
 *
 * **No `branchId`.** A membership scopes through `member.branch_id` — the
 * member's home gym is the one fact, and a copy on this row could only drift
 * when someone is moved between branches.
 *
 * ## The constraint Drizzle cannot express
 *
 * ```sql
 * ALTER TABLE memberships ADD CONSTRAINT memberships_no_overlap
 *   EXCLUDE USING gist (
 *     member_id WITH =,
 *     daterange(starts_on, ends_on, '[]') WITH &&
 *   ) WHERE (deleted_at IS NULL);
 * ```
 *
 * Hand-appended to the generated migration (`btree_gist` first, for the `=`
 * operator on a uuid inside a gist index). Drizzle has no exclusion-constraint
 * builder, so it is invisible to the snapshot — which is harmless: a later
 * `generate` simply never mentions it, and therefore never drops it.
 *
 * It is the point of the design rather than a safety net. Early renewal is not
 * a special case: September runs to the 30th, October starts on the 1st, they
 * do not overlap, both rows are real and cover is unbroken. What the database
 * physically refuses is selling the same day twice. `'[]'` because `ends_on`
 * is INCLUSIVE, and the `WHERE deleted_at IS NULL` because a voided membership
 * must not keep reserving days it no longer covers.
 *
 * Violations arrive as SQLSTATE `23P01` — distinct from the `23505` a unique
 * index raises — and the service translates them to a 409.
 */
export const memberships = pgTable(
  'memberships',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    memberId: uuid('member_id')
      .notNull()
      .references(() => member.personId),
    planId: uuid('plan_id')
      .notNull()
      .references(() => membershipPlans.id),
    startsOn: date('starts_on')
      .notNull()
      .default(sql`current_date`),
    /**
     * INCLUSIVE — the last day the member may train, not the day after. A
     * 30-day plan starting today ends on day 29 (`startsOn + durationDays - 1`).
     * Off by one here is a free day for every member, forever.
     */
    endsOn: date('ends_on').notNull(),
    /**
     * A **snapshot** of `membership_plans.price` at the moment of sale, and the
     * only reason this column exists. Never join to the plan to render history:
     * the plan's price is what the product costs today, this is what this
     * member actually paid.
     */
    price: numeric('price', { precision: 12, scale: 2 }).notNull(),
    /**
     * A **snapshot** of `membership_plans.registration_fee`, and `'0.00'` for
     * everyone who is not joining for the first time. "First time" is decided
     * server-side inside the sale transaction — no prior membership rows at
     * all, soft-deleted ones included — never from a client-supplied flag.
     *
     * Its own column rather than folded into `price` on purpose. Folding makes
     * "what did we take in registrations this quarter" unanswerable, and it
     * would break what `price` means: the plan's cost at the moment of sale, so
     * a later price rise still reads correctly against history.
     *
     * The amount due is `price + registration_fee`; a complimentary membership
     * owes nothing regardless of either.
     *
     * `default('0')` is what let this column be added NOT NULL to a table that
     * already had rows, and it is also the right fallback: a write path that
     * forgets to set it charges no joining fee, which is the safe direction.
     */
    registrationFee: numeric('registration_fee', { precision: 12, scale: 2 })
      .notNull()
      .default('0'),
    /** A comped period — staff, a promotion. Still a real row, just unpaid. */
    isComplimentary: boolean('is_complimentary').notNull().default(false),
    /**
     * Who sold it, taken from the token and never from the request body.
     * Nullable because a membership may outlive the staff record that created
     * it, and because imports have no seller.
     */
    soldByStaffId: uuid('sold_by_staff_id').references(() => staff.personId),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    /** Soft delete — a mistaken sale is voided with its payment, never edited. */
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    // The member's history, and the "does anything cover today" lookup.
    index('memberships_member_ends_idx').on(table.memberId, table.endsOn),
    // Expiry sweeps and "who lapses this week" reports read this alone.
    index('memberships_ends_on_idx').on(table.endsOn),
  ],
);

export type Membership = typeof memberships.$inferSelect;
export type NewMembership = typeof memberships.$inferInsert;

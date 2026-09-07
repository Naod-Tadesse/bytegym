import {
  index,
  numeric,
  pgEnum,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { branches } from './branches';
import { member } from './member';
import { memberships } from './memberships';
import { staff } from './staff';

/**
 * How the money arrived. `cash` is the common case and the reason the shift
 * total exists — it is what the drawer is counted against.
 */
export const paymentMethod = pgEnum('payment_method', [
  'cash',
  'telebirr',
  'cbe_birr',
  'bank_transfer',
  'card',
]);

/**
 * Money received. **The one table in this schema with no `deleted_at`.**
 *
 * A mistaken payment is VOIDED, not deleted: `voided_at`, `voided_by_staff_id`
 * and `void_reason` are set and the row stays in every list. The usual
 * `isNull(deletedAt)` read filter would hide exactly the row an audit needs —
 * a receptionist reconciling a drawer has to see that 800 was taken and then
 * reversed, by whom and why, not a gap where it used to be. Only the SUM
 * excludes voided rows.
 *
 * No total is stored anywhere. What a membership has been paid, and what is
 * still owed, are `SUM()`s over this table computed on every read — a stored
 * balance would need every write path to remember to update it, and the day
 * one forgets the column lies while the front desk trusts it.
 */
export const payments = pgTable(
  'payments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Who paid. Denormalised from the membership so a member's ledger is one scan. */
    memberId: uuid('member_id')
      .notNull()
      .references(() => member.personId),
    /**
     * What it settles. **NOT NULL: a payment is only ever for a membership.**
     *
     * The joining fee used to be a payment of its own with no membership id;
     * it is now `memberships.registration_fee`, part of the amount due on the
     * period being sold. With that folded in there is nothing left for a
     * payment to be about, so the column is mandatory and there is no `kind`
     * discriminator — a column that is always one value invites someone to add
     * a second meaning later that the balance arithmetic will not honour.
     */
    membershipId: uuid('membership_id')
      .notNull()
      .references(() => memberships.id),
    /**
     * Where the money was taken, copied from the member's home gym at the time
     * of the payment and never from the request body. Unlike a membership —
     * which scopes through `member.branch_id` precisely so a copy cannot drift
     * — this one is deliberate: a payment is a fact about a place and a shift,
     * and moving a member between branches must not retrospectively move the
     * cash out of the drawer it was counted in.
     */
    branchId: uuid('branch_id')
      .notNull()
      .references(() => branches.id),
    /**
     * `numeric(12,2)`, left at Drizzle's default **string** typing. Never
     * `mode: 'number'`: a float cannot hold 0.10 + 0.20 exactly, and money
     * that is out by a cent is worse than money that is missing.
     */
    amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
    method: paymentMethod('method').notNull(),
    /** Telebirr transaction id, bank slip number — free text, not validated. */
    reference: varchar('reference', { length: 80 }),
    /** Taken from the access token, never the body. */
    receivedByStaffId: uuid('received_by_staff_id')
      .notNull()
      .references(() => staff.personId),
    receivedAt: timestamp('received_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    note: varchar('note', { length: 255 }),
    /** Set together, by the void endpoint. Null on a live payment. */
    voidedAt: timestamp('voided_at', { withTimezone: true }),
    voidedByStaffId: uuid('voided_by_staff_id').references(
      () => staff.personId,
    ),
    voidReason: varchar('void_reason', { length: 255 }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    // The balance subquery on every membership read.
    index('payments_membership_idx').on(table.membershipId),
    // A member's payment history.
    index('payments_member_received_idx').on(table.memberId, table.receivedAt),
    // The shift reconciliation: one branch, one day.
    index('payments_branch_received_idx').on(table.branchId, table.receivedAt),
  ],
);

export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;

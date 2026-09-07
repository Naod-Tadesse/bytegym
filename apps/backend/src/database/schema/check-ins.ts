import {
  bigserial,
  date,
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

import { branches } from './branches';
import { member } from './member';
import { memberships } from './memberships';
import { person } from './person';
import { staff } from './staff';

/**
 * One row per member per day they trained. **The attendance ledger: written
 * once, never updated and never deleted** — hence no `deleted_at`, no
 * `updated_at` and no PATCH on the controller. That someone walked in is a
 * fact, and a fact that can be edited is not evidence of anything.
 *
 * ## Why `checked_in_on` exists beside `checked_in_at`
 *
 * It looks like redundancy and is not. The obvious alternative — a unique index
 * on `(member_id, (checked_in_at::date))` — **cannot be created at all**:
 * casting a `timestamptz` to a `date` reads the session's TimeZone, so Postgres
 * classes the expression as STABLE rather than IMMUTABLE and refuses it in an
 * index outright.
 *
 * And if it were allowed it would still be wrong. The server session runs in
 * UTC while the gym is in Addis (UTC+3), so a 01:00 check-in is 22:00 the
 * PREVIOUS day in UTC: every early-morning visit would be filed under the wrong
 * gym day, and the member could scan again at 04:00 for a second "first" visit.
 *
 * So the application writes the gym's own local date explicitly, from
 * `gymToday()` in `src/common/gym-day.ts` — never
 * `new Date().toISOString().slice(0, 10)`, which is the UTC day. It also leaves
 * room for a business day that does not start at midnight: a 22:00-to-06:00 gym
 * would only need `gymToday()` to shift, with no schema change and no reindex.
 *
 * ## ONE CHECK-IN PER MEMBER PER DAY
 *
 * `check_ins_member_day_uniq` is that rule, and it is the rule rather than a
 * safety net: a second scan is **not** an error. Members leave for lunch and
 * come back, and a 409 at the desk is a worse answer than none — the endpoint
 * looks for today's row and returns it. The index is the backstop for the race
 * that pre-check cannot cover: two turnstiles scanning at once both see no row,
 * both insert, and the loser gets `23505`, which the service translates into
 * the winner's row rather than an error.
 */
export const checkIns = pgTable(
  'check_ins',
  {
    /**
     * `bigserial`, not a uuid: attendance is the highest-volume table here (one
     * row per member per day, forever) and it is only ever read in ranges by
     * day, which a monotonic key clusters naturally.
     *
     * `mode: 'bigint'` maps it to a JS `BigInt`, which **`JSON.stringify`
     * refuses to serialise**. That is deliberate rather than a hazard: the API
     * casts this to text in every select, because a bigint beyond 2^53 does not
     * survive a JSON number either. Selecting the raw column would fail loudly
     * at the first request rather than silently round ids in ten years.
     */
    id: bigserial('id', { mode: 'bigint' }).primaryKey(),
    memberId: uuid('member_id')
      .notNull()
      .references(() => member.personId),
    /**
     * Which period of cover the visit fell under, for "how often did they come
     * on the membership they bought". **Null on an override** — that is exactly
     * what an override is: admitted with nothing covering the day.
     */
    membershipId: uuid('membership_id').references(() => memberships.id),
    /**
     * Where they trained — copied from the **member's** home gym, never the
     * caller's. A payment's branch is the drawer it landed in; this one is the
     * door they walked through, and both are facts about a place at a time.
     * The column branch scope filters on.
     */
    branchId: uuid('branch_id')
      .notNull()
      .references(() => branches.id),
    /**
     * Who was on the desk, from the access token and never the body. A person
     * rather than a staff id so a future self-service turnstile or member app
     * can record itself without inventing a staff row; nullable for the same
     * reason, and because the row must outlive whoever recorded it.
     */
    recordedByPersonId: uuid('recorded_by_person_id').references(
      () => person.id,
    ),
    /**
     * Set only when someone with `checkin.override` let a member in with no
     * membership covering the day. Null on every ordinary check-in, so
     * `where override_by_staff_id is not null` is the list a manager reviews.
     *
     * Note what it does NOT cover: a suspension is never overridable here.
     */
    overrideByStaffId: uuid('override_by_staff_id').references(
      () => staff.personId,
    ),
    /** The gym's local date — see the note above. Written, never derived. */
    checkedInOn: date('checked_in_on').notNull(),
    checkedInAt: timestamp('checked_in_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    // No `checked_out_at`. It was reserved for a turnstile recording exits,
    // but nothing ever wrote it, and a column that always reads null is worse
    // than no column: every reader has to learn it means nothing. If exits are
    // ever recorded, add it back then — the shape will be obvious once the
    // hardware exists, and it may not even belong on this row.
  },
  (table) => [
    // The rule, and the race guard. Plain rather than partial: nothing here
    // soft-deletes, so there is no deleted row to squat a member's day.
    uniqueIndex('check_ins_member_day_uniq').on(
      table.memberId,
      table.checkedInOn,
    ),
    // The list endpoint's own query: one branch, one day, newest first.
    index('check_ins_branch_day_idx').on(table.branchId, table.checkedInOn),
    // "How many visits on this membership" — the only read that starts here.
    index('check_ins_membership_idx').on(table.membershipId),
  ],
);

export type CheckIn = typeof checkIns.$inferSelect;
export type NewCheckIn = typeof checkIns.$inferInsert;

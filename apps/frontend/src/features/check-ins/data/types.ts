import type { MembershipStatus } from '@/features/members/data/types';
import type { TableState } from '@/services/pagination';

/**
 * Hand-written mirror of `CheckInResponseDto`. There is no codegen, so this and
 * the DTO change together.
 */
export interface CheckIn {
  /**
   * A **string**, though the column is a `bigserial`: a bigint does not survive
   * JSON as a number, so it arrives quoted and stays that way. It is only ever
   * a React key here — nothing does arithmetic on it.
   */
  id: string;
  /** The member's person id, as everywhere else in the member half. */
  memberId: string;
  memberName: string;
  memberCode: string;
  /**
   * Null when nobody's membership covered the day — which is exactly what an
   * override looks like on the record.
   */
  membershipId: string | null;
  branchId: string;
  branchName: string;
  /** Nullable defensively: a soft-deleted staff row leaves the join empty. */
  recordedByName: string | null;
  /**
   * Set only when someone with `checkin.override` admitted a member the rules
   * would have refused. Null is the normal case, and the pair of them is what a
   * manager scans the day's list for.
   */
  overrideByName: string | null;
  /** The gym's calendar day, `yyyy-MM-dd`. Not derived from `checkedInAt`. */
  checkedInOn: string;
  /** Full ISO timestamp — rendered in the gym's timezone, never the browser's. */
  checkedInAt: string;
  /**
   * Where they stand **today**, not on the day of this visit. Deliberately not
   * derived from `membershipId`, which records what covered them at the time:
   * the manager reading this list wants to see who is about to lapse.
   */
  membershipStatus: MembershipStatus;
  /** The last day any membership covers, or null if there has never been one. */
  expiresOn: string | null;
  /**
   * The first day of the membership covering today, null when nothing does.
   * With `expiresOn` it bounds the whole stretch they have paid for and not
   * used — the denominator for "how far through are they".
   */
  coverStartsOn: string | null;
}

/**
 * Why the door stayed shut, as the API says it rather than as it words it.
 *
 * The 403 body carries this beside a human `message`, and **this** is what the
 * UI branches on: the prose is free to be reworded, and four refusals that
 * demand four different next actions cannot be told apart by matching strings.
 *
 * - `suspended` — barred from the premises. `checkin.override` does **not**
 *   bypass it; the next action is to fetch a manager.
 * - `expired` — they have bought before and nothing covers today. They owe
 *   money: sell them a renewal.
 * - `none` — they have never bought one. Sell them a membership.
 */
export type CheckInRefusalReason = 'suspended' | 'expired' | 'none';

export const CHECK_IN_REFUSAL_REASONS: CheckInRefusalReason[] = [
  'suspended',
  'expired',
  'none',
];

/**
 * What happened the last time this member was scanned on this screen.
 *
 * UI state, not a wire type, and held **per member**: the desk view shows
 * several matches at once, and a toast cannot say which of them it was about.
 */
export type CheckInOutcome =
  | {
      kind: 'admitted';
      /** `false` when the API replayed today's existing row (a 200, not a 201). */
      wasNew: boolean;
      checkedInAt: string;
    }
  | {
      kind: 'refused';
      /** `null` when the 403 carried no reason we recognise. */
      reason: CheckInRefusalReason | null;
    };

/**
 * `from`/`to` are gym calendar days, `yyyy-MM-dd`, and **both inclusive** —
 * the same date twice is one day, which is how the desk asks for today.
 *
 * There is no `on`: the endpoint took one and now takes a range, and the
 * whitelisting `ValidationPipe` strips anything else. A leftover `on` would not
 * error — it would be dropped, the range would fall back to the server's
 * default, and the desk would quietly render a different day's list than the
 * one it asked for.
 *
 * `search` is inherited from `TableState` but the endpoint ignores it (a
 * check-in carries no text of its own), so every screen built on this hides its
 * search box rather than offering a control that filters nothing.
 */
export interface CheckInTableState extends TableState {
  from?: string;
  to?: string;
  memberId?: string;
  branchId?: string;
}

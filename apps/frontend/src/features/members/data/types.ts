import type { TableState } from '@/services/pagination';

export type Gender = 'male' | 'female';

/**
 * Derived on every read, never stored: `active` is a membership covering today,
 * `expired` is one that has run out, and `never` is a member who has not bought
 * one yet. `never` is a real answer the front desk acts on — it is not missing
 * data, and it must not render as a blank cell.
 */
export type MembershipStatus = 'active' | 'expired' | 'never';

/**
 * The identifier is the person id — `member` is keyed by it, exactly as
 * `staff_profiles` is. It is what every route param and every mutation takes;
 * `memberCode` (MBR00001) is a human-facing label, never an argument.
 */
export interface MemberListItem {
  personId: string;
  memberCode: string;
  firstName: string;
  lastName: string;
  phone: string;
  dateOfBirth: string | null;
  gender: Gender | null;
  branchId: string;
  branchName: string;
  /**
   * Barred from the premises. Independent of whether they have paid — an
   * expired membership is a different refusal with a different next step.
   */
  isSuspended: boolean;
  /**
   * Whether they have paid for today. Independent of `isSuspended` — the two
   * are different refusals with different next steps, so both are rendered.
   */
  membershipStatus: MembershipStatus;
  /** The furthest `endsOn` they hold; `null` when `membershipStatus` is `never`. */
  expiresOn: string | null;
  createdAt: string;
}

export interface MemberDetail extends MemberListItem {
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
  updatedAt: string;
}

export type MemberTableState = TableState;

/**
 * Hand-written mirror of the membership response DTO. There is no codegen, so
 * this and `MembershipResponseDto` change together.
 *
 * Memberships are only ever seen through a member, so they live here rather
 * than in a feature folder of their own.
 */
export interface Membership {
  id: string;
  memberId: string;
  planId: string;
  /** Snapshot of the plan's name at sale — a renamed plan does not rewrite history. */
  planName: string;
  /** `yyyy-MM-dd`. Both ends are **inclusive**: a 30-day plan ends on day 29. */
  startsOn: string;
  endsOn: string;
  /**
   * Snapshotted at sale, so a later price rise does not restate what was
   * charged. A **string** ("1500.00") the whole way — `formatBirr` is the only
   * place it ever meets `Number()`, and only to render it.
   */
  price: string;
  /**
   * The joining fee this sale charged, snapshotted like the price — `"0.00"`
   * for everyone who was not buying their first membership. Kept apart from
   * `price` so a total that looks too high can be explained: without it, an
   * `amountDue` of 2400 against a 1500 plan reads as a mistake.
   */
  registrationFee: string;
  /**
   * `price + registrationFee` — what this sale actually asked for, and the
   * figure `balance` is measured against. Computed and stored by the server at
   * sale time; the client never sends an amount and never re-derives this one.
   */
  amountDue: string;
  /** A comped membership: no money is owed, and it still occupies its dates. */
  isComplimentary: boolean;
  /**
   * Every non-voided payment against this membership, summed **in SQL**. Many
   * payments per membership is the normal case — "800 now, the rest on Friday".
   */
  paidTotal: string;
  /**
   * `amountDue - paidTotal`, also derived in SQL and never stored — voiding a
   * payment puts the money back on the balance on the next read. A string like
   * the rest: it is rendered, not added up.
   */
  balance: string;
  soldByStaffId: string;
  soldByName: string;
  createdAt: string;
}

import type { PaginationMeta, TableState } from '@/services/pagination';

/**
 * Hand-written mirrors of the payment DTOs. There is no codegen, so these and
 * `PaymentResponseDto` change together.
 */

/**
 * How it was taken. Mirrors the `payment_method` pgEnum.
 *
 * There is deliberately no `PaymentKind` beside it any more: a registration fee
 * is folded into its membership's `amountDue`, so every payment is a membership
 * payment and a field saying which kind it was could only ever hold one value.
 */
export type PaymentMethod =
  'cash' | 'telebirr' | 'cbe_birr' | 'bank_transfer' | 'card';

export const PAYMENT_METHODS: PaymentMethod[] = [
  'cash',
  'telebirr',
  'cbe_birr',
  'bank_transfer',
  'card',
];

export interface Payment {
  id: string;
  /** The member's person id, as everywhere else in the member half. */
  memberId: string;
  memberName: string;
  /**
   * The membership this settles. **Never null**: every payment is a membership
   * payment, and the joining fee is `registrationFee` on the membership itself
   * rather than a payment standing on its own.
   */
  membershipId: string;
  branchId: string;
  branchName: string;
  /**
   * A **string** ("800.00"), not a number: `numeric(12,2)` all the way to the
   * client so no float rounding is possible. `formatBirr` is the only place it
   * ever meets `Number()`, and only to render it.
   */
  amount: string;
  method: PaymentMethod;
  reference: string | null;
  note: string | null;
  /** Nullable defensively: a soft-deleted staff row leaves the join empty. */
  receivedByName: string | null;
  receivedAt: string;
  /**
   * A voided payment is **not** deleted and **not** filtered out of reads: the
   * shift reconciliation must still show it, with its reason and who cancelled
   * it. Only the `totals` envelope excludes it.
   */
  voidedAt: string | null;
  voidReason: string | null;
  voidedByName: string | null;
}

/**
 * The number a receptionist counts their drawer against — the SQL `SUM()` of
 * every non-voided payment matching the filter, across **all** pages.
 *
 * It is an envelope extra beside `data` and `meta` precisely because it cannot
 * be derived from `data`: the page in hand is one of many, and the amounts on
 * it are strings that must not be added up in JS.
 */
export interface PaymentTotals {
  received: string;
}

export interface PaginatedPayments {
  data: Payment[];
  meta: PaginationMeta;
  totals: PaymentTotals;
}

/**
 * `from`/`to` are date-only `yyyy-MM-dd`, both inclusive. `search` is inherited
 * from `TableState` but the endpoint does not take one — the list hides its
 * search box rather than offering a control the API would ignore.
 */
export interface PaymentTableState extends TableState {
  from?: string;
  to?: string;
  memberId?: string;
  membershipId?: string;
  /** The plan the settled membership was sold on. */
  planId?: string;
  /** How it was paid. A single value — `TableState.search` carries the text. */
  method?: PaymentMethod;
}

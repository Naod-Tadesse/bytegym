import type { TableState } from '@/services/pagination';

/** Hand-written mirror of `MembershipPlanDto`. There is no codegen. */
export interface MembershipPlan {
  id: string;
  name: string;
  description: string | null;
  /**
   * Days of cover. The end date is inclusive, so a 30-day plan starting today
   * ends on day 29 — the arithmetic lives on the server, not here.
   */
  durationDays: number;
  /**
   * A **string** on the wire ("1500.00") and a string here, all the way to the
   * input. The column is `numeric(12,2)`; parsing it into a float and
   * re-serialising is how money silently loses a cent. `formatBirr` is the only
   * place it is ever passed to `Number()`, and only to render it.
   */
  price: string;
  /**
   * A one-off charge added on top of {@link price} the **first** time a member
   * buys anything — `"900.00"`. `"0.00"` for a plan that carries none, which is
   * the default.
   *
   * Whether it actually applies is not a property of the plan: the sale decides
   * it from the member's `membershipStatus === 'never'`, and the membership row
   * snapshots whatever was charged. A string like every other money field.
   */
  registrationFee: string;
  /**
   * Plans retire by flipping this, never by deletion — every membership ever
   * sold points at the row.
   */
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type MembershipPlanTableState = TableState;

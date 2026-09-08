/** Hand-written mirror of `DashboardMembersDto`. There is no codegen. */
export interface DashboardMembers {
  total: number;
  /** A membership covers today. */
  active: number;
  expired: number;
  /** Registered, never bought one. A real state, not missing data. */
  never: number;
  /** `expired + never`, summed server-side so "inactive" has one definition. */
  inactive: number;
  /**
   * Barred from the premises. **Overlaps every count above** — suspension is a
   * decision about the person, not a billing state. Never add it to the others.
   */
  suspended: number;
}

/** Mirror of `DashboardPaymentsDto`. */
export interface DashboardPayments {
  count: number;
  /** Money as a string, always — never parsed, only formatted. */
  received: string;
}

/** Mirror of `DashboardDto`. */
export interface Dashboard {
  members: DashboardMembers;
  /** Visits on the **gym's** today, at most one per member. */
  checkInsToday: number;
  paymentsToday: DashboardPayments;
}

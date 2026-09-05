import type { DataScope } from '../common/enums';

/** Claims we sign into the access token. */
export interface JwtPayload {
  /** person.id — the standard JWT subject claim, kept as `sub`. */
  sub: string;
  /** staff.person_id — same value as sub for staff, kept explicit */
  staffId: string;
  /**
   * accounts.id — NOT the same value as sub. Roles hang off the account, so
   * permissions cannot be resolved without it, and re-querying it on every
   * request would be a needless round trip.
   */
  accountId: string;
  /** staff.primary_branch_id — what `branch` scope filters to. */
  branchId: string;
  /** `all` skips the branch filter entirely. */
  dataScope: DataScope;
  /**
   * Baked in at login so authorising a request costs no query. The trade-off
   * is staleness: a permission change only lands on the next refresh, which is
   * why anything altering roles, branch or scope revokes the user's sessions.
   */
  permissions: string[];
}

/** What JwtStrategy.validate() puts on request.user. */
export interface AuthenticatedUser {
  personId: string;
  staffId: string;
  accountId: string;
  branchId: string;
  dataScope: DataScope;
  permissions: string[];
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

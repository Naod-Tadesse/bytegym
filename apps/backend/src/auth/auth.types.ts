import type { DataScope } from '../common/enums';

/** Claims we sign into the access token. */
export interface JwtPayload {
  /** users.id */
  sub: string;
  /** staff_profiles.user_id — same value as sub for staff, kept explicit */
  staffId: string;
  /** staff_profiles.primary_branch_id — what `branch` scope filters to. */
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
  userId: string;
  staffId: string;
  branchId: string;
  dataScope: DataScope;
  permissions: string[];
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

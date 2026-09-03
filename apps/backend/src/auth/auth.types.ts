/** Claims we sign into the access token. */
export interface JwtPayload {
  /** users.id */
  sub: string;
  /** staff_profiles.user_id — same value as sub for staff, kept explicit */
  staffId: string;
  /**
   * Baked in at login so authorising a request costs no query. The trade-off
   * is staleness: a permission change only lands on the next refresh.
   */
  permissions: string[];
}

/** What JwtStrategy.validate() puts on request.user. */
export interface AuthenticatedUser {
  userId: string;
  staffId: string;
  permissions: string[];
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

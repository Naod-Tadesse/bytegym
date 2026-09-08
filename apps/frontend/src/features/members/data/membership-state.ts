import type { MembershipStatus } from './types';

/**
 * Whether the member holds a membership that has not run out.
 *
 * The gym sells **one live membership at a time**: while this is true,
 * `POST /memberships` refuses with a 409 naming the day it ends, so nothing in
 * the UI may offer a sale. Renewing early is not possible by design — a member
 * buys again on or after the day their membership lapses.
 *
 * Derived from the status rather than from `expiresOn`, because `expiresOn` is
 * a date the browser would have to compare against the gym's today, and the
 * browser's clock is not the gym's. The server has already made that
 * comparison in Addis time; this only reads its answer.
 */
export const hasLiveMembership = (status: MembershipStatus): boolean =>
  status === 'active';

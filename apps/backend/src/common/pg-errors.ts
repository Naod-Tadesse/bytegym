/**
 * Translating Postgres constraint violations into HTTP statuses.
 *
 * Every service that relies on a constraint — and they all should, because a
 * pre-check is a TOCTOU race — needs to turn the driver's error into the right
 * status, or a legitimate 409 surfaces as a 500.
 *
 * **The wrapping matters.** Drizzle v1 does not rethrow the pg error: it wraps
 * it in a `DrizzleQueryError` carrying the SQL and params, with the original on
 * `cause`. So `error.code` is `undefined` and a check written against it never
 * matches. That is why this walks the chain rather than reading one property.
 */

/** How far to follow `cause`. Two links is the observed depth; five is slack. */
const MAX_CAUSE_DEPTH = 5;

/**
 * The SQLSTATE of a database error, wherever the driver stack has buried it.
 */
export function pgErrorCode(error: unknown): string | undefined {
  let current: unknown = error;

  for (let depth = 0; depth < MAX_CAUSE_DEPTH; depth += 1) {
    if (typeof current !== 'object' || current === null) return undefined;

    const { code } = current as { code?: unknown };
    if (typeof code === 'string') return code;

    current = (current as { cause?: unknown }).cause;
  }
  return undefined;
}

/**
 * `23505` — a unique index rejected the row.
 *
 * The index is the real guard, never the friendly pre-check: two concurrent
 * requests both see "no duplicate" under READ COMMITTED, both insert, and the
 * second is rejected. Wrapping check-and-insert in a transaction changes
 * nothing. The pre-check stays for the common case's better message; this is
 * what stops the race returning a 500 instead of a 409.
 */
export const isUniqueViolation = (error: unknown): boolean =>
  pgErrorCode(error) === '23505';

/**
 * `23P01` — an exclusion constraint rejected the row.
 *
 * Deliberately distinct from `23505`: raised by `memberships_no_overlap`, and
 * it means "those days are already sold to this member", not "that name is
 * taken". Same reasoning, different sentence to the user.
 */
export const isExclusionViolation = (error: unknown): boolean =>
  pgErrorCode(error) === '23P01';

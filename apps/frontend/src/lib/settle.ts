/**
 * Awaits a mutation without rethrowing.
 *
 * Dialogs need `mutateAsync` so their spinner stays up until the request lands,
 * but a rejection there becomes an unhandled rejection — and there is nothing
 * left to handle: the axios response interceptor has already toasted the error.
 * Returns `undefined` on failure so callers can tell the two apart.
 */
export async function settle<T>(promise: Promise<T>): Promise<T | undefined> {
  try {
    return await promise;
  } catch {
    return undefined;
  }
}

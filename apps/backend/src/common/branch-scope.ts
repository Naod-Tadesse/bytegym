import { ForbiddenException, NotFoundException } from '@nestjs/common';

import type { AuthenticatedUser } from '../auth/auth.types';
import type { DataScope } from './enums';

/**
 * The branch this caller's queries are confined to, or `null` for no limit.
 *
 * Every scoped query should build its filter from this rather than reading
 * `user.branchId` directly — one place to change when scope grows beyond a
 * single branch (a `staff_branches` assignment table would return `string[]`).
 */
export const branchScopeOf = (user: AuthenticatedUser): string | null =>
  user.dataScope === 'all' ? null : user.branchId;

/**
 * Guards a single record on the way in or out.
 *
 * Throws `NotFoundException`, not `Forbidden`: a branch-scoped user should not
 * be able to tell "this id belongs to another branch" from "this id does not
 * exist", or the API becomes an existence oracle for other branches' records.
 */
export function assertInScope(
  scope: string | null,
  branchId: string,
  message: string,
): void {
  if (scope && branchId !== scope) {
    throw new NotFoundException(message);
  }
}

/**
 * Guards a write that names a branch — creating staff, or moving someone.
 *
 * Forbidden rather than NotFound here: the caller supplied this branch id
 * themselves, so there is nothing to conceal and the refusal should be legible.
 */
export function assertCanWriteToBranch(
  scope: string | null,
  branchId: string,
): void {
  if (scope && branchId !== scope) {
    throw new ForbiddenException('You can only manage your own branch');
  }
}

/**
 * Stops a branch-scoped user creating or promoting someone to `all` scope —
 * otherwise the branch limit is one POST away from being escaped.
 */
export function assertCanGrantScope(
  scope: string | null,
  requested: DataScope | undefined,
): void {
  if (scope && requested === 'all') {
    throw new ForbiddenException('You cannot grant access to all branches');
  }
}

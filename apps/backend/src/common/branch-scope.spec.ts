import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';

import type { AuthenticatedUser } from '../auth/auth.types';
import type { Database } from '../database/database.client';
import {
  assertBranchExists,
  assertCanGrantScope,
  assertCanWriteToBranch,
  assertInScope,
  branchScopeOf,
} from './branch-scope';

const MAIN = '11111111-1111-4111-8111-111111111111';
const OTHER = '22222222-2222-4222-8222-222222222222';

const userWith = (dataScope: 'branch' | 'all'): AuthenticatedUser => ({
  personId: 'p',
  staffId: 's',
  accountId: 'a',
  branchId: MAIN,
  dataScope,
  permissions: [],
});

/**
 * Permissions answer *what may you do*; data scope answers *over which rows*.
 * These are the four guards that make the second one real, and the distinction
 * between 404 and 403 in them is deliberate rather than incidental.
 */
describe('branchScopeOf', () => {
  it('confines a branch-scoped user to their own branch', () => {
    expect(branchScopeOf(userWith('branch'))).toBe(MAIN);
  });

  it('returns null — no filter — for an all-scope user', () => {
    expect(branchScopeOf(userWith('all'))).toBeNull();
  });

  it('still returns the branch id when scope is branch, even though the user has one either way', () => {
    // primary_branch_id stays NOT NULL at either scope: an owner is still
    // *based* somewhere, the flag only turns the filter off. So the difference
    // has to come from dataScope, never from a missing branch.
    const owner = userWith('all');
    expect(owner.branchId).toBe(MAIN);
    expect(branchScopeOf(owner)).toBeNull();
  });
});

describe('assertInScope', () => {
  it('allows a record in the callers branch', () => {
    expect(() => assertInScope(MAIN, MAIN, 'Member not found')).not.toThrow();
  });

  it('allows anything when the scope is null', () => {
    expect(() => assertInScope(null, OTHER, 'Member not found')).not.toThrow();
  });

  it('throws NotFound, never Forbidden, for another branch', () => {
    // A 403 would confirm the id exists, turning the endpoint into an
    // existence oracle for other branches' records.
    expect(() => assertInScope(MAIN, OTHER, 'Member not found')).toThrow(
      NotFoundException,
    );
  });

  it('uses the caller supplied message, so each resource says its own name', () => {
    expect(() => assertInScope(MAIN, OTHER, 'Payment not found')).toThrow(
      'Payment not found',
    );
  });
});

describe('assertCanWriteToBranch', () => {
  it('allows writing to the callers own branch', () => {
    expect(() => assertCanWriteToBranch(MAIN, MAIN)).not.toThrow();
  });

  it('allows an all-scope caller to write anywhere', () => {
    expect(() => assertCanWriteToBranch(null, OTHER)).not.toThrow();
  });

  it('throws Forbidden — not NotFound — for another branch', () => {
    // The exception to the 404 rule: the caller supplied this branch id
    // themselves, so there is nothing to conceal and the refusal should say so.
    expect(() => assertCanWriteToBranch(MAIN, OTHER)).toThrow(ForbiddenException);
    expect(() => assertCanWriteToBranch(MAIN, OTHER)).toThrow(
      'You can only manage your own branch',
    );
  });
});

describe('assertCanGrantScope', () => {
  it('lets an all-scope caller grant all-scope', () => {
    expect(() => assertCanGrantScope(null, 'all')).not.toThrow();
  });

  it('lets a branch-scoped caller grant branch scope', () => {
    expect(() => assertCanGrantScope(MAIN, 'branch')).not.toThrow();
  });

  it('stops a branch-scoped caller minting an all-scope colleague', () => {
    // Otherwise the limit is one POST away from being escaped.
    expect(() => assertCanGrantScope(MAIN, 'all')).toThrow(ForbiddenException);
    expect(() => assertCanGrantScope(MAIN, 'all')).toThrow(
      'You cannot grant access to all branches',
    );
  });

  it('allows an omitted scope, which defaults to the narrower value', () => {
    expect(() => assertCanGrantScope(MAIN, undefined)).not.toThrow();
  });
});

describe('assertBranchExists', () => {
  const dbReturning = (rows: unknown[]) =>
    ({
      select: () => ({ from: () => ({ where: () => Promise.resolve(rows) }) }),
    }) as unknown as Database;

  it('passes when the branch is there', async () => {
    await expect(
      assertBranchExists(dbReturning([{ id: MAIN }]), MAIN),
    ).resolves.toBeUndefined();
  });

  it('throws BadRequest when it is not', async () => {
    // A 400 rather than letting the insert's foreign key produce a 500 — an
    // unknown job title already gets a clean 400, and the branch should not be
    // the odd one out.
    await expect(assertBranchExists(dbReturning([]), OTHER)).rejects.toThrow(
      BadRequestException,
    );
    await expect(assertBranchExists(dbReturning([]), OTHER)).rejects.toThrow(
      'Branch not found',
    );
  });
});

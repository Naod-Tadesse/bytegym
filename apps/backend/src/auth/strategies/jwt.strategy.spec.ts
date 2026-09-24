import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';

import type { JwtPayload } from '../auth.types';
import { JwtStrategy } from './jwt.strategy';

/**
 * What `validate` returns becomes `request.user`, which is the sole input to
 * PermissionsGuard and to every `branchScopeOf(user)` call. Anything wrong
 * here is wrong everywhere at once.
 */
describe('JwtStrategy', () => {
  let strategy: JwtStrategy;

  const payload = (over: Partial<JwtPayload> = {}): JwtPayload =>
    ({
      sub: 'person-id',
      staffId: 'staff-id',
      accountId: 'account-id',
      branchId: 'branch-id',
      dataScope: 'all',
      permissions: ['member.list'],
      ...over,
    }) as JwtPayload;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: { getOrThrow: () => 'a-test-secret' },
        },
      ],
    }).compile();

    strategy = moduleRef.get(JwtStrategy);
  });

  it('maps the claims onto the authenticated user', () => {
    expect(strategy.validate(payload())).toEqual({
      personId: 'person-id',
      staffId: 'staff-id',
      accountId: 'account-id',
      branchId: 'branch-id',
      dataScope: 'all',
      permissions: ['member.list'],
    });
  });

  it('reads the person id from `sub`, the standard claim', () => {
    expect(strategy.validate(payload({ sub: 'someone-else' })).personId).toBe(
      'someone-else',
    );
  });

  it('defaults a missing dataScope to the narrower value', () => {
    // A token minted before data_scope existed has neither claim. Treating it
    // as `branch` means the bug grants too little, never the whole gym — the
    // same reasoning that makes `branch` the column default.
    const legacy = payload({ dataScope: undefined as never });
    expect(strategy.validate(legacy).dataScope).toBe('branch');
  });

  it('defaults missing permissions to none rather than undefined', () => {
    // PermissionsGuard would cope either way, but an undefined array is one
    // `.includes` away from a crash in anything else that reads it.
    const legacy = payload({ permissions: undefined as never });
    expect(strategy.validate(legacy).permissions).toEqual([]);
  });

  it('keeps an explicit branch scope', () => {
    expect(strategy.validate(payload({ dataScope: 'branch' })).dataScope).toBe(
      'branch',
    );
  });

  it('carries the branch id through at either scope', () => {
    // primary_branch_id is NOT NULL whatever the scope: an owner is still
    // based somewhere, and branchScopeOf decides whether to filter on it.
    expect(strategy.validate(payload({ dataScope: 'all' })).branchId).toBe(
      'branch-id',
    );
    expect(strategy.validate(payload({ dataScope: 'branch' })).branchId).toBe(
      'branch-id',
    );
  });

  it('does not invent fields the token did not carry', () => {
    // request.user is exactly these six keys; anything else a caller reaches
    // for should be undefined rather than quietly defaulted.
    expect(Object.keys(strategy.validate(payload())).sort()).toEqual([
      'accountId',
      'branchId',
      'dataScope',
      'permissions',
      'personId',
      'staffId',
    ]);
  });
});

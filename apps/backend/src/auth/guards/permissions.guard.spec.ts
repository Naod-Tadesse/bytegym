import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';

import type { AuthenticatedUser } from '../auth.types';
import { PermissionsGuard } from './permissions.guard';

/**
 * The second of the two global guards: JwtAuthGuard authenticates, this
 * authorises. Everything the API refuses on permission grounds is refused
 * here, so the three cases below are the whole authorisation model.
 */
describe('PermissionsGuard', () => {
  let guard: PermissionsGuard;
  let reflector: Reflector;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [PermissionsGuard, Reflector],
    }).compile();

    guard = moduleRef.get(PermissionsGuard);
    reflector = moduleRef.get(Reflector);
  });

  /** A context carrying whatever JwtAuthGuard would have put on the request. */
  const contextFor = (user?: Partial<AuthenticatedUser>): ExecutionContext =>
    ({
      getHandler: () => () => undefined,
      getClass: () => class {},
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    }) as unknown as ExecutionContext;

  /** `getAllAndOverride` is called for @Public() first, then @Permissions(). */
  const metadata = (isPublic: boolean, required?: string[]) => {
    jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockImplementationOnce(() => isPublic as never)
      .mockImplementationOnce(() => required as never);
  };

  it('lets a @Public() route through with no user at all', () => {
    metadata(true);
    expect(guard.canActivate(contextFor(undefined))).toBe(true);
  });

  it('checks @Public() before anything else, so it never reads permissions', () => {
    const spy = jest
      .spyOn(reflector, 'getAllAndOverride')
      .mockImplementationOnce(() => true as never);
    guard.canActivate(contextFor(undefined));
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it('allows a route with no @Permissions() — authenticated is enough', () => {
    metadata(false, undefined);
    expect(guard.canActivate(contextFor({ permissions: [] }))).toBe(true);
  });

  it('allows a route decorated with an empty permission list', () => {
    metadata(false, []);
    expect(guard.canActivate(contextFor({ permissions: [] }))).toBe(true);
  });

  it('allows a caller holding the one required permission', () => {
    metadata(false, ['member.list']);
    expect(guard.canActivate(contextFor({ permissions: ['member.list'] }))).toBe(
      true,
    );
  });

  it('requires ALL listed permissions, not any of them', () => {
    // @Permissions('a', 'b') is a conjunction. Holding one is not enough.
    metadata(false, ['member.list', 'member.read']);
    expect(() =>
      guard.canActivate(contextFor({ permissions: ['member.list'] })),
    ).toThrow(ForbiddenException);
  });

  it('allows a caller holding all of several', () => {
    metadata(false, ['member.list', 'member.read']);
    expect(
      guard.canActivate(
        contextFor({ permissions: ['member.read', 'member.list', 'extra'] }),
      ),
    ).toBe(true);
  });

  it('names only the permissions actually missing', () => {
    // So the documented 403 names what was enforced, and the message is
    // actionable rather than a restatement of the decorator.
    metadata(false, ['member.list', 'member.read']);
    expect(() =>
      guard.canActivate(contextFor({ permissions: ['member.list'] })),
    ).toThrow('Missing permission: member.read');
  });

  it('names several missing permissions in one message', () => {
    metadata(false, ['staff.create', 'role.assign']);
    expect(() => guard.canActivate(contextFor({ permissions: [] }))).toThrow(
      'Missing permission: staff.create, role.assign',
    );
  });

  it('refuses when there is no user on the request', () => {
    // Belt to JwtAuthGuard's braces: a guarded route must never fall open
    // because authentication was somehow skipped.
    metadata(false, ['member.list']);
    expect(() => guard.canActivate(contextFor(undefined))).toThrow(
      ForbiddenException,
    );
  });

  it('refuses when the token carries no permissions array', () => {
    // A token minted before permissions existed, or a malformed claim.
    metadata(false, ['member.list']);
    expect(() =>
      guard.canActivate(contextFor({ permissions: undefined as never })),
    ).toThrow(ForbiddenException);
  });

  it('matches permission names exactly, with no namespacing or prefixing', () => {
    // The string in @Permissions() is the string in permissions.name. Nothing
    // maps them, which is why a near-miss must not be treated as a match.
    metadata(false, ['member.list']);
    expect(() =>
      guard.canActivate(contextFor({ permissions: ['members.list'] })),
    ).toThrow(ForbiddenException);
  });

  it('is case sensitive', () => {
    metadata(false, ['member.list']);
    expect(() =>
      guard.canActivate(contextFor({ permissions: ['Member.List'] })),
    ).toThrow(ForbiddenException);
  });

  it('reads permissions from the token, not from the database', () => {
    // The guard's whole input is the request's user object. This is why a
    // grant change does not take effect until the token is reissued, and why
    // every grant change revokes sessions.
    metadata(false, ['report.view']);
    const context = contextFor({ permissions: ['report.view'] });
    expect(guard.canActivate(context)).toBe(true);
  });
});

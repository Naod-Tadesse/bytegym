import { Test } from '@nestjs/testing';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import type { AuthenticatedUser } from './auth.types';
import { isPublic, permissionsOn } from '../testing/permissions-metadata';

const user: AuthenticatedUser = {
  personId: 'person-id',
  staffId: 'staff-id',
  accountId: 'account-id',
  branchId: 'branch-id',
  dataScope: 'all',
  permissions: [],
};

/**
 * The only routes in the API that anyone may reach without a token, and the
 * only ones where getting the public/authenticated split wrong opens a hole
 * rather than merely inconveniencing someone.
 */
describe('AuthController', () => {
  let controller: AuthController;

  const service = {
    login: jest.fn(),
    refresh: jest.fn(),
    logout: jest.fn(),
    me: jest.fn(),
    changePassword: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: service }],
    }).compile();

    controller = moduleRef.get(AuthController);
  });

  describe('what is reachable without a token', () => {
    it('marks login public', () => {
      expect(isPublic(AuthController, 'login')).toBe(true);
    });

    it('marks refresh public', () => {
      // It has to be: the whole point is renewing an access token that has
      // already expired, so requiring a live one would be circular.
      expect(isPublic(AuthController, 'refresh')).toBe(true);
    });

    it.each(['logout', 'me', 'changePassword'])(
      'does not mark %s public',
      (method) => {
        expect(isPublic(AuthController, method)).toBe(false);
      },
    );

    it('puts no @Permissions() on any auth route', () => {
      // These are authenticated-only: there is no permission that means "may
      // read your own identity" or "may change your own password".
      for (const method of ['login', 'refresh', 'logout', 'me', 'changePassword']) {
        expect(permissionsOn(AuthController, method)).toBeUndefined();
      }
    });
  });

  describe('delegation', () => {
    it('passes the credentials to login', () => {
      const dto = { phone: '0911000000', password: 'Admin@123' };
      controller.login(dto);
      expect(service.login).toHaveBeenCalledWith(dto);
    });

    it('unwraps the refresh token from the body', () => {
      controller.refresh({ refreshToken: 'a-token' });
      expect(service.refresh).toHaveBeenCalledWith('a-token');
    });

    it('logs out the person from the token, and the device from the body', () => {
      // Identity from the token; which session to end from the body.
      controller.logout(user, { refreshToken: 'this-device' });
      expect(service.logout).toHaveBeenCalledWith('person-id', 'this-device');
    });

    it('logs out everywhere when no refresh token is given', () => {
      controller.logout(user, {} as never);
      expect(service.logout).toHaveBeenCalledWith('person-id', undefined);
    });

    it('survives a missing body entirely', () => {
      // The DTO is optional on this route, so `dto?.refreshToken` has to hold.
      expect(() => controller.logout(user, undefined as never)).not.toThrow();
      expect(service.logout).toHaveBeenCalledWith('person-id', undefined);
    });

    it('passes the whole user to me, which re-resolves from the database', () => {
      // /auth/me reads permissions live rather than echoing the token, which
      // is why the UI sees a grant change before the next sign-in.
      controller.me(user);
      expect(service.me).toHaveBeenCalledWith(user);
    });

    it('passes the user and the body to changePassword', () => {
      const dto = { currentPassword: 'old-one', newPassword: 'a-new-one' };
      controller.changePassword(user, dto);
      expect(service.changePassword).toHaveBeenCalledWith(user, dto);
    });

    it('returns nothing from logout or changePassword', async () => {
      // Both answer 204, so a body would be dropped anyway — and returning
      // one would suggest there is something to read.
      await expect(controller.logout(user, {} as never)).resolves.toBeUndefined();
      await expect(
        controller.changePassword(user, {} as never),
      ).resolves.toBeUndefined();
    });
  });
});

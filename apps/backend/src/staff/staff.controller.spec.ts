import { Test } from '@nestjs/testing';

import type { AuthenticatedUser } from '../auth/auth.types';
import { permissionsOn } from '../testing/permissions-metadata';
import { StaffController } from './staff.controller';
import { StaffService } from './staff.service';

const MAIN = '11111111-1111-4111-8111-111111111111';
const ME = 'my-staff-id';

const user = (dataScope: 'branch' | 'all' = 'branch'): AuthenticatedUser => ({
  personId: 'person',
  staffId: ME,
  accountId: 'account',
  branchId: MAIN,
  dataScope,
  permissions: [],
});

/**
 * Staff is where identity matters most: several routes refuse to act on the
 * caller themselves, and that check is only as good as the id it is given.
 * "Identity comes from the token, never the request body" is the rule these
 * tests exist to hold.
 */
describe('StaffController', () => {
  let controller: StaffController;

  const service = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    resetPassword: jest.fn(),
    grantAccess: jest.fn(),
    setAuthorization: jest.fn(),
    setAccountStatus: jest.fn(),
    revokeAccess: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      controllers: [StaffController],
      providers: [{ provide: StaffService, useValue: service }],
    }).compile();

    controller = moduleRef.get(StaffController);
  });

  describe('identity comes from the token', () => {
    it('passes the callers own staff id when disabling a login', () => {
      // The service refuses when this equals the target. If the id came from
      // the body, disabling your own login would be one curl away.
      controller.setAccountStatus('target', { status: 'disabled' }, user());
      expect(service.setAccountStatus).toHaveBeenCalledWith(
        'target',
        'disabled',
        ME,
        MAIN,
      );
    });

    it('passes it when revoking access', () => {
      controller.revokeAccess('target', user());
      expect(service.revokeAccess).toHaveBeenCalledWith('target', ME, MAIN);
    });

    it('passes it when terminating', () => {
      controller.remove('target', user());
      expect(service.remove).toHaveBeenCalledWith('target', ME, MAIN);
    });

    it('takes the actor id from the token even when the body carries one', () => {
      // whitelist strips an undeclared `staffId` from the DTO, but the
      // controller must not read one even if it survived.
      const hostile = { status: 'disabled', staffId: 'someone-else' } as never;
      controller.setAccountStatus('target', hostile, user());
      expect(service.setAccountStatus).toHaveBeenCalledWith(
        'target',
        'disabled',
        ME,
        MAIN,
      );
    });

    it('unwraps the new password from the body rather than passing the DTO', () => {
      // No actor id here, and none is needed: resetting a password is not
      // self-destructive, so there is nothing to guard against doing to
      // yourself — unlike disabling, revoking and terminating.
      controller.resetPassword('target', { newPassword: 'Secret@1234' }, user());
      expect(service.resetPassword).toHaveBeenCalledWith(
        'target',
        'Secret@1234',
        MAIN,
      );
    });
  });

  describe('scoping', () => {
    it('confines a branch-scoped caller', () => {
      controller.findAll({}, user('branch'));
      expect(service.findAll).toHaveBeenCalledWith({}, MAIN);
    });

    it('lifts the filter for an all-scope caller', () => {
      controller.findAll({}, user('all'));
      expect(service.findAll).toHaveBeenCalledWith({}, null);
    });

    it('scopes every route that names a staff member', () => {
      const caller = user('branch');
      controller.findOne('t', caller);
      controller.update('t', {}, caller);
      controller.grantAccess('t', { password: 'x' } as never, caller);
      controller.setAuthorization('t', {}, caller);

      for (const call of [
        service.findOne.mock.calls[0],
        service.update.mock.calls[0],
        service.grantAccess.mock.calls[0],
        service.setAuthorization.mock.calls[0],
      ]) {
        expect(call.at(-1)).toBe(MAIN);
      }
    });
  });

  describe('permissions', () => {
    it.each([
      ['findAll', ['staff.list']],
      ['findOne', ['staff.read']],
      ['create', ['staff.create']],
      ['update', ['staff.update']],
      ['remove', ['staff.terminate']],
    ])('%s requires %s', (method, expected) => {
      expect(permissionsOn(StaffController, method)).toEqual(expected);
    });

    it('keeps the three access permissions distinct', () => {
      // Three different acts: helping someone locked out of an account they
      // already have, handing someone a login for the first time, and taking
      // one away. A receptionist might reasonably hold only the first.
      expect(permissionsOn(StaffController, 'resetPassword')).toEqual([
        'staff.resetPassword',
      ]);
      expect(permissionsOn(StaffController, 'grantAccess')).toEqual([
        'staff.grantAccess',
      ]);
      expect(permissionsOn(StaffController, 'revokeAccess')).toEqual([
        'staff.revokeAccess',
      ]);
    });

    it('gates authorisation changes on role.assign, not staff.update', () => {
      // Changing who someone *is* differs from changing what they may do.
      expect(permissionsOn(StaffController, 'setAuthorization')).toEqual([
        'role.assign',
      ]);
    });

    it('treats disabling and revoking as the same permission', () => {
      // Both take access away; the difference is whether the password
      // survives, which is a choice for whoever already holds the permission.
      expect(permissionsOn(StaffController, 'setAccountStatus')).toEqual(
        permissionsOn(StaffController, 'revokeAccess'),
      );
    });
  });
});

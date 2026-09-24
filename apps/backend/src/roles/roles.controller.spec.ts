import { Test } from '@nestjs/testing';

import { permissionsOn } from '../testing/permissions-metadata';
import { PermissionsController } from './permissions.controller';
import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';

/**
 * Roles are the authorisation model's own CRUD, so the permission gating here
 * is the thing that stops someone widening their own access.
 */
describe('RolesController', () => {
  let controller: RolesController;
  let permissionsController: PermissionsController;

  const service = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    syncPermissions: jest.fn(),
    listPermissions: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      controllers: [RolesController, PermissionsController],
      providers: [{ provide: RolesService, useValue: service }],
    }).compile();

    controller = moduleRef.get(RolesController);
    permissionsController = moduleRef.get(PermissionsController);
  });

  describe('delegation', () => {
    it('passes the query to findAll', () => {
      controller.findAll({ page: 1 });
      expect(service.findAll).toHaveBeenCalledWith({ page: 1 });
    });

    it('passes the id to findOne', () => {
      controller.findOne('role-id');
      expect(service.findOne).toHaveBeenCalledWith('role-id');
    });

    it('passes the body to create', () => {
      controller.create({ name: 'Manager' });
      expect(service.create).toHaveBeenCalledWith({ name: 'Manager' });
    });

    it('passes id and body to update', () => {
      controller.update('role-id', { isActive: false });
      expect(service.update).toHaveBeenCalledWith('role-id', { isActive: false });
    });

    it('passes the id to remove', () => {
      controller.remove('role-id');
      expect(service.remove).toHaveBeenCalledWith('role-id');
    });

    it('unwraps the permission ids from the body when syncing', () => {
      // A full replace: the service diffs it so untouched grants keep their
      // created_at, but what arrives is the complete desired set.
      controller.syncPermissions('role-id', { permissionIds: ['a', 'b'] });
      expect(service.syncPermissions).toHaveBeenCalledWith('role-id', ['a', 'b']);
    });

    it('passes an empty set through, which revokes everything', () => {
      controller.syncPermissions('role-id', { permissionIds: [] });
      expect(service.syncPermissions).toHaveBeenCalledWith('role-id', []);
    });

    it('takes no branch scope on any route', () => {
      // Roles are gym-wide: a branch-scoped manager does not get their own
      // private set of roles.
      controller.findAll({});
      expect(service.findAll.mock.calls[0]).toHaveLength(1);
    });
  });

  describe('permissions', () => {
    it.each([
      ['findAll', ['role.list']],
      ['findOne', ['role.list']],
      ['create', ['role.create']],
      ['update', ['role.update']],
      ['remove', ['role.delete']],
    ])('%s requires %s', (method, expected) => {
      expect(permissionsOn(RolesController, method)).toEqual(expected);
    });

    it('gates assigning permissions on role.assign, not role.update', () => {
      // Renaming a role and changing what it can do are different powers.
      expect(permissionsOn(RolesController, 'syncPermissions')).toEqual([
        'role.assign',
      ]);
    });

    it('gates the catalogue on role.list', () => {
      // There is no separate permission for reading permissions: anyone who
      // may see roles needs to see what a role could contain.
      expect(permissionsOn(PermissionsController, 'listPermissions')).toEqual([
        'role.list',
      ]);
    });
  });

  describe('the permission catalogue', () => {
    it('returns the list unpaginated', () => {
      // The catalogue is code — fixed, small, and with no API to add to it —
      // so it comes back as a plain array rather than in a paging envelope.
      service.listPermissions.mockReturnValue(['a', 'b']);
      expect(permissionsController.listPermissions()).toEqual(['a', 'b']);
      expect(service.listPermissions).toHaveBeenCalledWith();
    });
  });
});

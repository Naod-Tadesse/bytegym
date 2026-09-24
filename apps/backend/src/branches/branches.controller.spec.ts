import { Test } from '@nestjs/testing';

import { permissionsOn } from '../testing/permissions-metadata';
import { BranchesController } from './branches.controller';
import { BranchesService } from './branches.service';

/**
 * Controllers here are deliberately thin — services own all data access — so
 * what is worth testing is the wiring: that each route delegates with the
 * arguments it was given, and that it is gated on the permission it claims.
 */
describe('BranchesController', () => {
  let controller: BranchesController;

  const service = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    deactivate: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      controllers: [BranchesController],
      providers: [{ provide: BranchesService, useValue: service }],
    }).compile();

    controller = moduleRef.get(BranchesController);
  });

  describe('delegation', () => {
    it('passes the pagination query through to findAll', () => {
      const query = { page: 2, limit: 25, search: 'Bole' };
      service.findAll.mockReturnValue('paged');

      expect(controller.findAll(query)).toBe('paged');
      expect(service.findAll).toHaveBeenCalledWith(query);
    });

    it('passes the id through to findOne', () => {
      controller.findOne('branch-id');
      expect(service.findOne).toHaveBeenCalledWith('branch-id');
    });

    it('passes the body through to create', () => {
      const dto = { name: 'Bole', city: 'Addis Ababa' };
      controller.create(dto);
      expect(service.create).toHaveBeenCalledWith(dto);
    });

    it('passes id and body through to update', () => {
      const dto = { city: 'Adama' };
      controller.update('branch-id', dto);
      expect(service.update).toHaveBeenCalledWith('branch-id', dto);
    });

    it('routes DELETE to deactivate, not to a delete', () => {
      // There is no hard delete and no `branch.delete` permission: a branch
      // that ever took a payment has to stay resolvable forever.
      controller.deactivate('branch-id');
      expect(service.deactivate).toHaveBeenCalledWith('branch-id');
    });

    it('does not scope branches by the callers branch', () => {
      // Branches are the one resource without a data-scope filter — a
      // branch-scoped caller loses `branch.*` entirely instead, in
      // resolvePermissions. So no route here takes a scope argument.
      controller.findAll({});
      expect(service.findAll).toHaveBeenCalledWith({});
      expect(service.findAll.mock.calls[0]).toHaveLength(1);
    });
  });

  describe('permissions', () => {
    it.each([
      ['findAll', ['branch.list']],
      ['findOne', ['branch.list']],
      ['create', ['branch.create']],
      ['update', ['branch.update']],
    ])('%s requires %s', (method, expected) => {
      expect(permissionsOn(BranchesController, method)).toEqual(expected);
    });

    it('deactivating requires branch.update, because branch.delete does not exist', () => {
      // A deliberate gap in the catalogue: retiring a branch is an update, not
      // a deletion, and there is no permission that would say otherwise.
      expect(permissionsOn(BranchesController, 'deactivate')).toEqual([
        'branch.update',
      ]);
    });

    it('reading and listing share one permission', () => {
      // Unlike staff, where `staff.list` and `staff.read` are split so a role
      // can see the roster without opening individual records.
      expect(permissionsOn(BranchesController, 'findOne')).toEqual(
        permissionsOn(BranchesController, 'findAll'),
      );
    });
  });
});

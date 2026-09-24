import { Test } from '@nestjs/testing';

import type { AuthenticatedUser } from '../auth/auth.types';
import { permissionsOn } from '../testing/permissions-metadata';
import { MembersController } from './members.controller';
import { MembersService } from './members.service';

const MAIN = '11111111-1111-4111-8111-111111111111';

const user = (dataScope: 'branch' | 'all'): AuthenticatedUser => ({
  personId: 'person',
  staffId: 'staff',
  accountId: 'account',
  branchId: MAIN,
  dataScope,
  permissions: [],
});

/**
 * Every route here is branch-scoped, and the scope is derived from the token
 * through `branchScopeOf` rather than read off `user.branchId` directly. These
 * tests pin that: read-scoping without write-scoping is theatre, so the write
 * paths matter as much as the reads.
 */
describe('MembersController', () => {
  let controller: MembersController;

  const service = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    setSuspension: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      controllers: [MembersController],
      providers: [{ provide: MembersService, useValue: service }],
    }).compile();

    controller = moduleRef.get(MembersController);
  });

  describe('scoping reads', () => {
    it('confines a branch-scoped caller to their branch', () => {
      controller.findAll({}, user('branch'));
      expect(service.findAll).toHaveBeenCalledWith({}, MAIN);
    });

    it('passes null — no filter — for an all-scope caller', () => {
      controller.findAll({}, user('all'));
      expect(service.findAll).toHaveBeenCalledWith({}, null);
    });

    it('scopes findOne too, so an id cannot be guessed across branches', () => {
      controller.findOne('member-id', user('branch'));
      expect(service.findOne).toHaveBeenCalledWith('member-id', MAIN);
    });
  });

  describe('scoping writes', () => {
    it('scopes create', () => {
      const dto = { firstName: 'A', lastName: 'B', phone: '0912345678', branchId: MAIN };
      controller.create(dto, user('branch'));
      expect(service.create).toHaveBeenCalledWith(dto, MAIN);
    });

    it('scopes update', () => {
      controller.update('member-id', { lastName: 'C' }, user('branch'));
      expect(service.update).toHaveBeenCalledWith('member-id', { lastName: 'C' }, MAIN);
    });

    it('scopes delete', () => {
      controller.remove('member-id', user('branch'));
      expect(service.remove).toHaveBeenCalledWith('member-id', MAIN);
    });

    it('scopes suspension, and unwraps the flag from the body', () => {
      controller.setSuspension('member-id', { isSuspended: true }, user('branch'));
      expect(service.setSuspension).toHaveBeenCalledWith('member-id', true, MAIN);
    });

    it('passes the suspension flag through as false, not as the body', () => {
      controller.setSuspension('member-id', { isSuspended: false }, user('all'));
      expect(service.setSuspension).toHaveBeenCalledWith('member-id', false, null);
    });

    it('gives every write path a scope argument', () => {
      // If one were missed, a branch manager could reach another branch's
      // record by guessing an id — which read-scoping alone would not stop.
      const branchUser = user('branch');
      controller.create({} as never, branchUser);
      controller.update('id', {}, branchUser);
      controller.setSuspension('id', { isSuspended: true }, branchUser);
      controller.remove('id', branchUser);

      for (const call of [
        service.create.mock.calls[0],
        service.update.mock.calls[0],
        service.setSuspension.mock.calls[0],
        service.remove.mock.calls[0],
      ]) {
        expect(call.at(-1)).toBe(MAIN);
      }
    });
  });

  describe('permissions', () => {
    it.each([
      ['findAll', ['member.list']],
      ['findOne', ['member.read']],
      ['create', ['member.create']],
      ['update', ['member.update']],
      ['remove', ['member.delete']],
    ])('%s requires %s', (method, expected) => {
      expect(permissionsOn(MembersController, method)).toEqual(expected);
    });

    it('suspending is an update, not a delete', () => {
      // Suspension is reversible and is a change to the member, so it sits
      // with the other edits rather than behind the destructive permission.
      expect(permissionsOn(MembersController, 'setSuspension')).toEqual([
        'member.update',
      ]);
    });

    it('separates listing from reading', () => {
      expect(permissionsOn(MembersController, 'findAll')).not.toEqual(
        permissionsOn(MembersController, 'findOne'),
      );
    });
  });
});

import { Test } from '@nestjs/testing';

import type { AuthenticatedUser } from '../auth/auth.types';
import { permissionsOn } from '../testing/permissions-metadata';
import { MembershipsController } from './memberships.controller';
import { MembershipsService } from './memberships.service';

const MAIN = '11111111-1111-4111-8111-111111111111';
const ME = 'my-staff-id';

const user = (
  over: Partial<AuthenticatedUser> = {},
): AuthenticatedUser => ({
  personId: 'person',
  staffId: ME,
  accountId: 'account',
  branchId: MAIN,
  dataScope: 'branch',
  permissions: [],
  ...over,
});

describe('MembershipsController', () => {
  let controller: MembershipsController;

  const service = { findAll: jest.fn(), findOne: jest.fn(), sell: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      controllers: [MembershipsController],
      providers: [{ provide: MembershipsService, useValue: service }],
    }).compile();

    controller = moduleRef.get(MembershipsController);
  });

  describe('selling', () => {
    const dto = { memberId: 'member', planId: 'plan' };

    it('records who sold it from the token, never the body', () => {
      controller.sell({ ...dto, soldByStaffId: 'someone-else' } as never, user());
      expect(service.sell).toHaveBeenCalledWith(
        expect.objectContaining({ memberId: 'member' }),
        ME,
        MAIN,
        [],
      );
    });

    it('hands the callers permissions to the service rather than a boolean', () => {
      // Attaching a payment is a second act with its own permission, and that
      // decision belongs in the service beside the write it guards — so the
      // claims travel, not a pre-computed yes/no.
      const seller = user({ permissions: ['membership.sell', 'payment.record'] });
      controller.sell(dto as never, seller);
      expect(service.sell).toHaveBeenCalledWith(
        expect.anything(),
        ME,
        MAIN,
        ['membership.sell', 'payment.record'],
      );
    });

    it('scopes the sale to the callers branch', () => {
      controller.sell(dto as never, user({ dataScope: 'branch' }));
      expect(service.sell.mock.calls[0][2]).toBe(MAIN);
    });

    it('lifts the scope for an all-scope caller', () => {
      controller.sell(dto as never, user({ dataScope: 'all' }));
      expect(service.sell.mock.calls[0][2]).toBeNull();
    });
  });

  describe('reading', () => {
    it('scopes the list', () => {
      controller.findAll({}, user());
      expect(service.findAll).toHaveBeenCalledWith({}, MAIN);
    });

    it('scopes a single membership', () => {
      // memberships have no branch column of their own — they scope through
      // member_profiles.branch_id — but the controller does not need to know.
      controller.findOne('membership-id', user());
      expect(service.findOne).toHaveBeenCalledWith('membership-id', MAIN);
    });
  });

  describe('permissions', () => {
    it('lists and reads under one permission', () => {
      expect(permissionsOn(MembershipsController, 'findAll')).toEqual([
        'membership.list',
      ]);
      expect(permissionsOn(MembershipsController, 'findOne')).toEqual([
        'membership.list',
      ]);
    });

    it('gates selling on membership.sell alone', () => {
      // payment.record is checked inside the service, only when a payment is
      // actually attached — so a seller who never takes money does not need it.
      expect(permissionsOn(MembershipsController, 'sell')).toEqual([
        'membership.sell',
      ]);
    });

    it('exposes no update or delete route', () => {
      // ends_on is set at sale and never moves: no freeze, no goodwill
      // extension. Those would be the routes that let it move.
      expect(
        Object.getOwnPropertyNames(MembershipsController.prototype),
      ).toEqual(expect.not.arrayContaining(['update', 'remove', 'delete']));
    });
  });
});

import { Test } from '@nestjs/testing';

import { permissionsOn } from '../testing/permissions-metadata';
import { MembershipPlansController } from './membership-plans.controller';
import { MembershipPlansService } from './membership-plans.service';

describe('MembershipPlansController', () => {
  let controller: MembershipPlansController;

  const service = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      controllers: [MembershipPlansController],
      providers: [{ provide: MembershipPlansService, useValue: service }],
    }).compile();

    controller = moduleRef.get(MembershipPlansController);
  });

  it('passes the query, including the isActive filter', () => {
    controller.findAll({ isActive: true } as never);
    expect(service.findAll).toHaveBeenCalledWith({ isActive: true });
  });

  it('passes the id to findOne', () => {
    controller.findOne('plan-id');
    expect(service.findOne).toHaveBeenCalledWith('plan-id');
  });

  it('passes the body to create', () => {
    const dto = { name: 'Monthly', durationDays: 30, price: '1000' };
    controller.create(dto as never);
    expect(service.create).toHaveBeenCalledWith(dto);
  });

  it('retires a plan through update rather than a delete route', () => {
    // A plan that was ever sold has to stay resolvable, so it is retired by
    // flipping isActive — there is no plan.delete permission and no route.
    controller.update('plan-id', { isActive: false } as never);
    expect(service.update).toHaveBeenCalledWith('plan-id', { isActive: false });
  });

  it('is not branch scoped', () => {
    // Plans are sold at every branch; there is one catalogue for the gym.
    controller.findAll({} as never);
    expect(service.findAll.mock.calls[0]).toHaveLength(1);
  });

  describe('permissions', () => {
    it.each([
      ['findAll', ['plan.list']],
      ['findOne', ['plan.list']],
      ['create', ['plan.create']],
      ['update', ['plan.update']],
    ])('%s requires %s', (method, expected) => {
      expect(permissionsOn(MembershipPlansController, method)).toEqual(expected);
    });

    it('exposes no delete route', () => {
      expect(
        Object.getOwnPropertyNames(MembershipPlansController.prototype),
      ).toEqual(expect.not.arrayContaining(['remove', 'delete']));
    });
  });
});

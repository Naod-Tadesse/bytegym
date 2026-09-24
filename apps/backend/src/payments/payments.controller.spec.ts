import { Test } from '@nestjs/testing';

import type { AuthenticatedUser } from '../auth/auth.types';
import { permissionsOn } from '../testing/permissions-metadata';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

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
 * Money, so the two things that matter are who is recorded as having handled
 * it and which rows a caller can reach.
 */
describe('PaymentsController', () => {
  let controller: PaymentsController;

  const service = { findAll: jest.fn(), record: jest.fn(), void: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      controllers: [PaymentsController],
      providers: [{ provide: PaymentsService, useValue: service }],
    }).compile();

    controller = moduleRef.get(PaymentsController);
  });

  it('records who took the payment from the token', () => {
    const dto = { memberId: 'm', membershipId: 'ms', amount: '500', method: 'cash' };
    controller.record(dto as never, user());
    expect(service.record).toHaveBeenCalledWith(dto, ME, MAIN);
  });

  it('ignores a receivedByStaffId in the body', () => {
    const hostile = {
      memberId: 'm',
      membershipId: 'ms',
      amount: '500',
      method: 'cash',
      receivedByStaffId: 'someone-else',
    };
    controller.record(hostile as never, user());
    expect(service.record.mock.calls[0][1]).toBe(ME);
  });

  it('records who voided it, and unwraps the reason from the body', () => {
    // The reason is required and kept: the first reversal is the one that
    // happened, and overwriting it would lose why.
    controller.void('payment-id', { reason: 'Rang it up twice' }, user());
    expect(service.void).toHaveBeenCalledWith(
      'payment-id',
      'Rang it up twice',
      ME,
      MAIN,
    );
  });

  it('scopes the register to the callers branch', () => {
    const query = { method: 'cash' };
    controller.findAll(query as never, user('branch'));
    expect(service.findAll).toHaveBeenCalledWith(query, MAIN);
  });

  it('lifts the filter for an all-scope caller', () => {
    controller.findAll({} as never, user('all'));
    expect(service.findAll).toHaveBeenCalledWith({}, null);
  });

  it('scopes voiding too, so another branch cannot be reversed by id', () => {
    controller.void('payment-id', { reason: 'x' }, user('branch'));
    expect(service.void.mock.calls[0].at(-1)).toBe(MAIN);
  });

  describe('permissions', () => {
    it.each([
      ['findAll', ['payment.list']],
      ['record', ['payment.record']],
      ['void', ['payment.void']],
    ])('%s requires %s', (method, expected) => {
      expect(permissionsOn(PaymentsController, method)).toEqual(expected);
    });

    it('separates taking money from reversing it', () => {
      // A receptionist can reasonably take payments all day and never be
      // allowed to reverse one.
      expect(permissionsOn(PaymentsController, 'record')).not.toEqual(
        permissionsOn(PaymentsController, 'void'),
      );
    });

    it('exposes no delete route', () => {
      // A payment is voided, never removed: the record of the mistake is part
      // of the audit trail.
      expect(Object.getOwnPropertyNames(PaymentsController.prototype)).toEqual(
        expect.not.arrayContaining(['remove', 'delete']),
      );
    });
  });
});

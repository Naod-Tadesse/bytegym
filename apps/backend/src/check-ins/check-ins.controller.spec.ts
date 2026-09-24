import { HttpStatus } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { Response } from 'express';

import type { AuthenticatedUser } from '../auth/auth.types';
import { permissionsOn } from '../testing/permissions-metadata';
import { CheckInsController } from './check-ins.controller';
import { CheckInsService } from './check-ins.service';

const MAIN = '11111111-1111-4111-8111-111111111111';

const user = (dataScope: 'branch' | 'all' = 'branch'): AuthenticatedUser => ({
  personId: 'person',
  staffId: 'staff',
  accountId: 'account',
  branchId: MAIN,
  dataScope,
  permissions: [],
});

/**
 * The one route in this API that chooses its own status code. A repeat scan is
 * not an error — members leave for lunch and come back — so the desk gets 200
 * with today's existing row rather than a 409 that says neither "they are in"
 * nor "they are not".
 */
describe('CheckInsController', () => {
  let controller: CheckInsController;

  const service = { findAll: jest.fn(), record: jest.fn() };

  /** Enough of express's Response to see what status was chosen. */
  const responseSpy = () => {
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    return { res: { status } as unknown as Response, status, json };
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      controllers: [CheckInsController],
      providers: [{ provide: CheckInsService, useValue: service }],
    }).compile();

    controller = moduleRef.get(CheckInsController);
  });

  describe('choosing the status code', () => {
    it('answers 201 on the first scan of the gym day', async () => {
      service.record.mockResolvedValue({ created: true, row: { id: 1 } });
      const { res, status, json } = responseSpy();

      await controller.record({ memberId: 'm' } as never, user(), res);

      expect(status).toHaveBeenCalledWith(HttpStatus.CREATED);
      expect(json).toHaveBeenCalledWith({ id: 1 });
    });

    it('answers 200 on a repeat scan, with the row unchanged', async () => {
      service.record.mockResolvedValue({ created: false, row: { id: 1 } });
      const { res, status, json } = responseSpy();

      await controller.record({ memberId: 'm' } as never, user(), res);

      expect(status).toHaveBeenCalledWith(HttpStatus.OK);
      expect(json).toHaveBeenCalledWith({ id: 1 });
    });

    it('returns nothing from the handler itself', async () => {
      // With @Res() Nest hands the response over entirely; returning a value
      // as well makes it log a warning and ignore it.
      service.record.mockResolvedValue({ created: true, row: {} });
      const { res } = responseSpy();

      await expect(
        controller.record({ memberId: 'm' } as never, user(), res),
      ).resolves.toBeUndefined();
    });
  });

  describe('what the server decides', () => {
    it('passes the whole user, not just a scope', () => {
      // The service needs the permissions too: `override: true` is only
      // honoured for a caller holding checkin.override, and it decides that
      // itself rather than trusting a flag from here.
      service.record.mockResolvedValue({ created: true, row: {} });
      const caller = user();
      const dto = { memberId: 'm', override: true };

      void controller.record(dto as never, caller, responseSpy().res);

      expect(service.record).toHaveBeenCalledWith(dto, caller);
    });

    it('scopes the register to the callers branch', () => {
      controller.findAll({} as never, user('branch'));
      expect(service.findAll).toHaveBeenCalledWith({}, MAIN);
    });

    it('lifts the filter for an all-scope caller', () => {
      controller.findAll({} as never, user('all'));
      expect(service.findAll).toHaveBeenCalledWith({}, null);
    });
  });

  describe('permissions', () => {
    it('gates the register on checkin.list', () => {
      expect(permissionsOn(CheckInsController, 'findAll')).toEqual([
        'checkin.list',
      ]);
    });

    it('gates recording on checkin.record alone', () => {
      // checkin.override is deliberately NOT listed: an override is a
      // variation on recording, checked in the service, not a separate route
      // someone could be locked out of entirely.
      expect(permissionsOn(CheckInsController, 'record')).toEqual([
        'checkin.record',
      ]);
    });
  });
});

import { Test } from '@nestjs/testing';

import type { AuthenticatedUser } from '../auth/auth.types';
import { permissionsOn } from '../testing/permissions-metadata';
import { SmsController } from './sms.controller';
import { SmsMessagesService } from './sms-messages.service';

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
 * Messages cost money and reach real phones, so the three SMS permissions are
 * deliberately separate — reading the log, sending one, and sending to
 * everyone are three different powers.
 */
describe('SmsController', () => {
  let controller: SmsController;

  const service = {
    findAll: jest.fn(),
    send: jest.fn(),
    broadcast: jest.fn(),
    recipients: jest.fn(),
    getSettings: jest.fn(),
    updateSettings: jest.fn(),
    sendDueReminders: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      controllers: [SmsController],
      providers: [{ provide: SmsMessagesService, useValue: service }],
    }).compile();

    controller = moduleRef.get(SmsController);
  });

  describe('sending', () => {
    it('records the sender from the token', () => {
      const dto = { phone: '0912345678', message: 'Hello' };
      controller.send(dto as never, user());
      expect(service.send).toHaveBeenCalledWith(dto, ME);
    });

    it('scopes a broadcast to the callers branch', () => {
      // Otherwise a branch manager would text the whole gym.
      const dto = { audience: 'all', message: 'Closed Monday' };
      controller.broadcast(dto as never, user('branch'));
      expect(service.broadcast).toHaveBeenCalledWith(dto, ME, MAIN);
    });

    it('lets an all-scope caller broadcast gym-wide', () => {
      controller.broadcast({ audience: 'all' } as never, user('all'));
      expect(service.broadcast).toHaveBeenCalledWith(
        expect.anything(),
        ME,
        null,
      );
    });
  });

  describe('previewing a broadcast', () => {
    it('returns a count and sends nothing', async () => {
      service.recipients.mockResolvedValue([{ id: 'a' }, { id: 'b' }]);

      const result = await controller.preview(
        { audience: 'all', message: 'x' } as never,
        user(),
      );

      expect(result).toEqual({ recipients: 2 });
      expect(service.broadcast).not.toHaveBeenCalled();
    });

    it('counts against the same scope the broadcast would use', () => {
      // A preview that counted more people than the send would reach would be
      // worse than no preview.
      service.recipients.mockResolvedValue([]);
      void controller.preview({ audience: 'all' } as never, user('branch'));
      expect(service.recipients).toHaveBeenCalledWith(
        expect.anything(),
        MAIN,
      );
    });

    it('returns zero rather than an empty array', async () => {
      service.recipients.mockResolvedValue([]);
      await expect(
        controller.preview({ audience: 'all' } as never, user()),
      ).resolves.toEqual({ recipients: 0 });
    });
  });

  describe('settings and reminders', () => {
    it('reads the settings row', () => {
      controller.getSettings();
      expect(service.getSettings).toHaveBeenCalledWith();
    });

    it('records who changed the settings', () => {
      controller.updateSettings({ reminderHour: 9 } as never, user());
      expect(service.updateSettings).toHaveBeenCalledWith(
        { reminderHour: 9 },
        ME,
      );
    });

    it('runs the reminder job on demand', () => {
      // The only way anybody tests a daily job without waiting a day.
      controller.runReminders();
      expect(service.sendDueReminders).toHaveBeenCalledWith();
    });
  });

  describe('permissions', () => {
    it.each([
      ['findAll', ['sms.list']],
      ['send', ['sms.send']],
      ['broadcast', ['sms.broadcast']],
      ['preview', ['sms.broadcast']],
      ['getSettings', ['sms.settings']],
      ['updateSettings', ['sms.settings']],
      ['runReminders', ['sms.settings']],
    ])('%s requires %s', (method, expected) => {
      expect(permissionsOn(SmsController, method)).toEqual(expected);
    });

    it('keeps reading, sending and broadcasting apart', () => {
      const [list, send, broadcast] = [
        permissionsOn(SmsController, 'findAll'),
        permissionsOn(SmsController, 'send'),
        permissionsOn(SmsController, 'broadcast'),
      ];
      expect(new Set([list?.[0], send?.[0], broadcast?.[0]]).size).toBe(3);
    });

    it('gates previewing exactly as broadcasting', () => {
      // Knowing how many people a message would reach is part of deciding to
      // send it, not a lesser act.
      expect(permissionsOn(SmsController, 'preview')).toEqual(
        permissionsOn(SmsController, 'broadcast'),
      );
    });
  });
});

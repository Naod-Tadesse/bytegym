import { Test } from '@nestjs/testing';

import { NotificationsService } from './notifications.service';
import { NotificationsGateway } from './websocket/notifications.gateway';
import { SmsService } from './sms/sms.service';

/**
 * The never-throws rule lives here, and it is load-bearing: a notification
 * must not be able to fail a sale. Every caller sends after taking money, and
 * an exception escaping this class would unwind a transaction that had already
 * been committed to in the gym's mind.
 */
describe('NotificationsService', () => {
  let service: NotificationsService;

  const sms = { send: jest.fn() };
  const gateway = { emitToBranch: jest.fn(), emitToStaff: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [
        NotificationsService,
        { provide: SmsService, useValue: sms },
        { provide: NotificationsGateway, useValue: gateway },
      ],
    }).compile();

    service = moduleRef.get(NotificationsService);
  });

  describe('sendSmsResult', () => {
    it('passes the number and message straight to the sender', async () => {
      sms.send.mockResolvedValue({ delivered: true });
      await service.sendSmsResult('0912345678', 'Hello');
      expect(sms.send).toHaveBeenCalledWith('0912345678', 'Hello');
    });

    it('returns the senders result untouched on success', async () => {
      const result = { delivered: true, reference: 'provider-id' };
      sms.send.mockResolvedValue(result);
      await expect(service.sendSmsResult('0912345678', 'Hi')).resolves.toEqual(
        result,
      );
    });

    it('returns a refusal as-is rather than throwing', async () => {
      const refused = { delivered: false, error: 'No SMS provider configured' };
      sms.send.mockResolvedValue(refused);
      await expect(service.sendSmsResult('0912345678', 'Hi')).resolves.toEqual(
        refused,
      );
    });

    it('swallows a thrown error and reports it as not delivered', async () => {
      // The adapters already swallow their own; this is the belt to those
      // braces, for anything that gets past them.
      sms.send.mockRejectedValue(new Error('socket hang up'));

      await expect(service.sendSmsResult('0912345678', 'Hi')).resolves.toEqual({
        delivered: false,
        error: 'socket hang up',
      });
    });

    it('copes with a non-Error being thrown', async () => {
      sms.send.mockRejectedValue('a bare string');
      await expect(service.sendSmsResult('0912345678', 'Hi')).resolves.toEqual({
        delivered: false,
        error: 'a bare string',
      });
    });

    it('never rejects, whatever the sender does', async () => {
      for (const behaviour of [
        () => Promise.reject(new Error('boom')),
        () => Promise.reject(undefined),
        () => {
          throw new Error('synchronous');
        },
      ]) {
        sms.send.mockImplementation(behaviour);
        await expect(
          service.sendSmsResult('0912345678', 'Hi'),
        ).resolves.toBeDefined();
      }
    });
  });

  describe('sendSms', () => {
    it('reduces the outcome to a boolean for fire-and-forget callers', async () => {
      sms.send.mockResolvedValue({ delivered: true });
      await expect(service.sendSms('0912345678', 'Hi')).resolves.toBe(true);
    });

    it('is false when nothing was delivered', async () => {
      sms.send.mockResolvedValue({ delivered: false, error: 'held' });
      await expect(service.sendSms('0912345678', 'Hi')).resolves.toBe(false);
    });

    it('is false rather than a rejection when the sender throws', async () => {
      sms.send.mockRejectedValue(new Error('boom'));
      await expect(service.sendSms('0912345678', 'Hi')).resolves.toBe(false);
    });
  });
});

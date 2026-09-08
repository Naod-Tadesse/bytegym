import { Injectable, Logger } from '@nestjs/common';

import {
  NOTIFICATION_EVENTS,
  type NotificationEvent,
  type NotificationPayload,
} from './notification-events';
import type { SmsResult } from './sms/sms-sender';
import { SmsService } from './sms/sms.service';
import { NotificationsGateway } from './websocket/notifications.gateway';

/**
 * The one thing the rest of the backend calls. Two channels behind it, and
 * neither is the caller's problem.
 *
 * **Nothing here ever throws, and nothing here is ever awaited for
 * correctness.** A notification is a consequence of work already done — the
 * membership is sold, the money is in the till, the member is through the door.
 * If the SMS gateway is down or no desk is connected, that must change none of
 * it. So every method catches its own failures and logs them, and a caller can
 * safely not await at all.
 *
 * The corollary is that this is **not** a delivery guarantee. There is no
 * queue, no retry and no outbox: a message lost to a restart is lost. That is
 * the right trade for "your membership expires Friday" and the wrong one for
 * anything a member could be harmed by missing — if that day comes, the fix is
 * a `notifications` table written in the same transaction as the event, drained
 * by a worker, not a retry loop bolted on here.
 */
@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly sms: SmsService,
    private readonly gateway: NotificationsGateway,
  ) {}

  /**
   * Text a member.
   *
   * @param phone Local Ethiopian form, `0912345678`, exactly as stored. The
   *   adapter adds the country code.
   *
   * Resolves either way. Check the returned `delivered` only if you have
   * something useful to do about a failure; most callers do not, and should
   * simply not await.
   */
  async sendSms(phone: string, message: string): Promise<boolean> {
    return (await this.sendSmsResult(phone, message)).delivered;
  }

  /**
   * The same send, with the whole outcome — delivered, held back by the test
   * allowlist, or refused, and why.
   *
   * For callers that write down what happened. `sendSms` is the short form for
   * everyone who only wants to fire and forget.
   */
  async sendSmsResult(phone: string, message: string): Promise<SmsResult> {
    try {
      const result = await this.sms.send(phone, message);

      if (!result.delivered && !result.held) {
        this.logger.warn(`SMS to ${phone} not delivered: ${result.error}`);
      }

      return result;
    } catch (error) {
      // The adapters already swallow their own errors; this is the belt to
      // that braces. A notification must not be able to fail a sale.
      const reason = error instanceof Error ? error.message : String(error);
      this.logger.error(`SMS to ${phone} threw: ${reason}`);
      return { delivered: false, error: reason };
    }
  }

  /**
   * Tell the desks something changed.
   *
   * `branchId` addresses it: staff at that branch and anyone with `all` scope.
   * Omit it for something that is not about one gym, and every signed-in staff
   * member sees it.
   *
   * Synchronous and fire-and-forget — socket.io buffers per client, so this
   * does not wait on the network.
   */
  broadcast(
    event: NotificationEvent,
    payload: Omit<NotificationPayload, 'at'>,
    branchId?: string,
  ): void {
    try {
      this.gateway.emitToBranch(
        event,
        // Stamped here, from the server's clock. A client's own clock decides
        // nothing — the same rule the gym day follows.
        { ...payload, at: new Date().toISOString() },
        branchId,
      );
    } catch (error) {
      this.logger.error(
        `Could not broadcast ${event}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /** The event names, so callers do not spell them by hand. */
  readonly events = NOTIFICATION_EVENTS;
}

import { Injectable, Logger } from '@nestjs/common';

import type { SmsResult, SmsSender } from './sms-sender';

/**
 * Writes the message to the log and sends nothing.
 *
 * **This is the default, and that is deliberate.** Sending an SMS costs money,
 * reaches a real person and cannot be recalled — so it must take a positive act
 * of configuration, never an omission. A developer running the seed, a test
 * that sells a membership, a staging box pointed at a copy of production: none
 * of them should text the gym's members, and with this as the fallback none of
 * them can.
 */
@Injectable()
export class LogSmsSender implements SmsSender {
  private readonly logger = new Logger('SMS');

  send(phone: string, message: string): Promise<SmsResult> {
    this.logger.log(
      `[not sent — no SMS provider configured] ${phone}: ${message}`,
    );

    // `delivered: false` is the honest answer: nothing was delivered. Saying
    // true would make a dry run indistinguishable from a live one in the logs.
    return Promise.resolve({
      delivered: false,
      error: 'No SMS provider configured',
    });
  }
}

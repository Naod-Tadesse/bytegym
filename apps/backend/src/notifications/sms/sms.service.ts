import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { SMS_SENDER, type SmsResult, type SmsSender } from './sms-sender';

/**
 * Lift the test restriction. Any other value — including leaving it unset — and
 * only the numbers in {@link SmsService.allowed} are ever texted.
 */
const UNRESTRICTED = 'all';

/**
 * While the gym is testing, the only number that may receive a message.
 *
 * A **default in code**, not merely a line in `.env`: forgetting an environment
 * variable must fail towards texting nobody, never towards texting every member
 * on the books. It is the same reasoning that makes `data_scope` default to
 * `branch` — the bug that skips the config grants too little, not too much.
 *
 * Remove this default when the gym goes live; `SMS_ALLOWED_RECIPIENTS=all` is
 * the switch until then.
 */
const TEST_RECIPIENTS = ['0968931531'];

/**
 * Sending, with the guards that must hold whatever the provider is.
 *
 * The allowlist lives here rather than in an adapter on purpose. An adapter is
 * the thing most likely to be swapped — a better rate, a different vendor — and
 * a safety rule that can be lost by changing providers is not a safety rule.
 */
@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly allowed: Set<string> | null;

  constructor(
    @Inject(SMS_SENDER) private readonly sender: SmsSender,
    config: ConfigService,
  ) {
    const configured = config.get<string>('SMS_ALLOWED_RECIPIENTS');

    if (configured?.trim() === UNRESTRICTED) {
      this.allowed = null;
      this.logger.warn(
        'SMS is unrestricted — every recipient will be texted for real',
      );
    } else {
      this.allowed = new Set(
        (configured?.trim()
          ? configured.split(',').map((one) => one.trim())
          : TEST_RECIPIENTS
        ).filter(Boolean),
      );
      this.logger.log(
        `SMS restricted to ${[...this.allowed].join(', ')} — set SMS_ALLOWED_RECIPIENTS=all to lift`,
      );
    }
  }

  /**
   * @param phone Local Ethiopian form, `0912345678`, exactly as stored. The
   *   adapter converts it for the provider.
   *
   * Resolves either way; never throws. A message to a number outside the
   * allowlist is dropped and logged, and reports `delivered: false` — because
   * nothing was delivered, and a dry run that claims success is worse than one
   * that fails loudly.
   */
  async send(phone: string, message: string): Promise<SmsResult> {
    if (this.allowed && !this.allowed.has(phone.trim())) {
      this.logger.log(
        `[held back — not an allowed test number] ${phone}: ${message}`,
      );
      return {
        delivered: false,
        held: true,
        error: 'Recipient not in the test allowlist',
      };
    }

    return this.sender.send(phone, message);
  }
}

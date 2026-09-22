import { Inject, Injectable } from '@nestjs/common';

import { SMS_SENDER, type SmsResult, type SmsSender } from './sms-sender';

/**
 * Sending, as the rest of the application sees it.
 *
 * Every member on the books is a valid recipient. There is no allowlist: the
 * one guard that decides whether anything leaves the building is which sender
 * is wired up, and that is `SMS_PROVIDER` — omit it and `LogSmsSender` writes
 * to the log instead. One switch, at the boundary, rather than a second filter
 * further in that has to be remembered and lifted.
 *
 * This stays a service rather than exporting `SMS_SENDER` directly because it
 * is the seam callers already depend on, and the natural home for anything that
 * must hold whatever the provider is — a rate limit, a quiet-hours rule, an
 * opt-out list keyed on the member rather than on config.
 */
@Injectable()
export class SmsService {
  constructor(@Inject(SMS_SENDER) private readonly sender: SmsSender) {}

  /**
   * @param phone Local Ethiopian form, `0912345678`, exactly as stored. The
   *   adapter converts it for the provider.
   *
   * Resolves either way; never throws. Delivery is best-effort, and a caller
   * that has just taken money must not lose its transaction because a text
   * did not go out.
   */
  send(phone: string, message: string): Promise<SmsResult> {
    return this.sender.send(phone, message);
  }
}

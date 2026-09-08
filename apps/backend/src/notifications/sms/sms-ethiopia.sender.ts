import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { type AxiosInstance } from 'axios';

import { toMsisdn, type SmsResult, type SmsSender } from './sms-sender';

/**
 * How long to wait on the provider before giving up.
 *
 * Short on purpose. This sits behind a request that has already done its real
 * work — the membership is sold, the money is recorded — and the caller is a
 * receptionist with somebody at the desk. A vendor having a bad day should cost
 * them five seconds, not thirty.
 */
const TIMEOUT_MS = 5_000;

/**
 * SMS Ethiopia — https://smsethiopia.et
 *
 * ```
 * POST /api/sms/send
 * KEY: <api key>
 * { "msisdn": "251911639555", "text": "Hello World" }
 * ```
 *
 * Two details that are easy to get wrong, and both are silent when you do:
 *
 * - The API key goes in a bare **`KEY`** header. Not `Authorization`, not
 *   `Bearer` — a bearer token here is simply an unauthenticated request.
 * - `msisdn` is **`251…` with no `+`**. The database holds `0968931531`, so
 *   `toMsisdn` swaps the leading zero for the country code.
 *
 * **The response shape is not documented to me.** The request format above came
 * from the gym; what comes back did not. So success is judged on the HTTP
 * status and the body is logged rather than parsed into a decision — see
 * `send`. If the provider returns failures inside a 200, as several of these
 * gateways do, this will read them as sent; the body in the log is what will
 * show that, and it is a one-line fix here once the shape is known.
 */
@Injectable()
export class SmsEthiopiaSender implements SmsSender {
  private readonly logger = new Logger('SMS');
  private readonly http: AxiosInstance;

  constructor(config: ConfigService) {
    this.http = axios.create({
      baseURL: config.get<string>('SMS_BASE_URL') ?? 'https://smsethiopia.et',
      timeout: TIMEOUT_MS,
      headers: { KEY: config.getOrThrow<string>('SMS_API_KEY') },
    });
  }

  async send(phone: string, message: string): Promise<SmsResult> {
    try {
      const { data, status } = await this.http.post<unknown>('/api/sms/send', {
        msisdn: toMsisdn(phone),
        text: message,
      });

      // Logged in full, at debug, precisely because the shape is unconfirmed:
      // the first real send is what reveals whether a failure can hide inside
      // a 200, and there is no way to know that without seeing one.
      this.logger.debug(`Provider answered ${status}: ${JSON.stringify(data)}`);

      return { delivered: true };
    } catch (error) {
      // Never rethrown. The caller has already done the thing that mattered.
      const reason =
        axios.isAxiosError(error) && error.response
          ? `${error.response.status} ${JSON.stringify(error.response.data)}`
          : error instanceof Error
            ? error.message
            : String(error);

      this.logger.warn(`Could not send to ${phone}: ${reason}`);
      return { delivered: false, error: reason };
    }
  }
}

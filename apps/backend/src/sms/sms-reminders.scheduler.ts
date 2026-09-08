import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import { gymHour } from '../common/gym-day';
import { SmsMessagesService } from './sms-messages.service';

/**
 * The one thing in this system that acts without anybody pressing a button.
 *
 * **It ticks hourly and decides for itself, rather than firing once at a fixed
 * time.** A `0 9 * * *` cron looks simpler and is worse: if the process is
 * restarting, deploying or down at nine o'clock, that day's reminders are
 * silently lost — nobody is told, and the members who should have been warned
 * simply are not. Because a reminder is idempotent per member per gym day, an
 * hourly tick that asks "is it past the hour, and has this one gone yet?"
 * catches up at ten instead of skipping the day.
 *
 * It holds no logic of its own beyond the clock. Who is due, what to say, and
 * whether to say it at all lives in `SmsMessagesService.sendDueReminders`, so
 * the same run can be triggered by hand from the API — which is the only way
 * anybody tests a daily job without waiting a day.
 */
@Injectable()
export class SmsRemindersScheduler {
  private readonly logger = new Logger(SmsRemindersScheduler.name);

  constructor(private readonly messages: SmsMessagesService) {}

  @Cron(CronExpression.EVERY_HOUR, { name: 'sms-expiry-reminders' })
  async run() {
    try {
      const settings = await this.messages.getSettings();
      if (!settings?.reminderEnabled) return;

      // The gym's hour, not the server's. Addis is UTC+3, so a job reading the
      // server clock would text members at six in the morning for a setting of
      // nine. Past the hour rather than equal to it: that is what makes a
      // missed tick recoverable instead of a lost day.
      const hour = gymHour();
      if (hour < settings.reminderHour) return;

      const result = await this.messages.sendDueReminders();

      // Only worth a line when something actually happened. Every other hour
      // of the day this finds everyone already done and would otherwise fill
      // the log with twenty-three identical entries.
      if (result.sent > 0) {
        this.logger.log(
          `Expiry reminders: ${result.sent} sent, ${result.skipped} already done today`,
        );
      }
    } catch (error) {
      // Swallowed deliberately. An unhandled rejection out of a cron takes the
      // process down with it, and a failed reminder run must not stop the gym
      // taking money. The next hourly tick retries, and tomorrow's run picks up
      // anyone still missed — the window is "within N days", not "exactly N".
      this.logger.error(
        `Reminder run failed: ${error instanceof Error ? error.stack : String(error)}`,
      );
    }
  }
}

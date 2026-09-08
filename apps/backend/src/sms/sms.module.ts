import { Module } from '@nestjs/common';

import { SmsController } from './sms.controller';
import { SmsMessagesService } from './sms-messages.service';
import { SmsRemindersScheduler } from './sms-reminders.scheduler';

/**
 * The messaging *feature* — what a gym sends and to whom.
 *
 * Distinct from `NotificationsModule`, which owns the plumbing: providers,
 * the allowlist, the socket. This module never touches a provider. It decides
 * who should hear something and writes down what happened, and hands the
 * sending to `NotificationsService`. That split is why swapping SMS vendor
 * cannot reach this far.
 */
@Module({
  controllers: [SmsController],
  providers: [SmsMessagesService, SmsRemindersScheduler],
  exports: [SmsMessagesService],
})
export class SmsModule {}

import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { LogSmsSender } from './log-sms.sender';
import { SmsEthiopiaSender } from './sms-ethiopia.sender';
import { SMS_SENDER, type SmsSender } from './sms-sender';
import { SmsService } from './sms.service';

/**
 * Which provider to use, decided once at boot.
 *
 * **The default sends nothing.** Configuring a provider is a positive act;
 * omitting `SMS_PROVIDER` gets the logging sender, so a developer, a test run
 * or a staging box pointed at a copy of production cannot text the gym's
 * members. An SMS costs money, reaches a real person and cannot be recalled —
 * not a thing to fall into by forgetting a variable.
 *
 * Adding a provider is one file implementing `SmsSender` and one case here.
 */
function smsSenderFactory(config: ConfigService): SmsSender {
  const provider = config.get<string>('SMS_PROVIDER');
  const logger = new Logger('SmsModule');

  switch (provider) {
    case 'smsethiopia':
      logger.log('SMS provider: smsethiopia');
      return new SmsEthiopiaSender(config);
    default:
      if (provider) {
        // Named something we do not have. Say so loudly rather than quietly
        // falling back — a gym that configured a provider and got silence
        // would believe its members were told things they never were.
        logger.warn(
          `Unknown SMS_PROVIDER "${provider}" — nothing will be sent`,
        );
      }
      return new LogSmsSender();
  }
}

/**
 * Text messages, and the one guard that has to outlive any provider choice —
 * the test allowlist in `SmsService`.
 *
 * Exports the service, never the sender: the allowlist is not optional, and a
 * caller holding `SMS_SENDER` directly could bypass it.
 */
@Module({
  providers: [
    {
      provide: SMS_SENDER,
      useFactory: smsSenderFactory,
      inject: [ConfigService],
    },
    SmsService,
  ],
  exports: [SmsService],
})
export class SmsModule {}

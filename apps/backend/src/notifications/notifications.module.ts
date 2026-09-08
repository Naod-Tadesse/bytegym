import { Global, Module } from '@nestjs/common';

import { NotificationsService } from './notifications.service';
import { SmsModule } from './sms/sms.module';
import { WebsocketModule } from './websocket/websocket.module';

/**
 * Telling people things, over whichever channel suits them.
 *
 * A facade over two modules that own their own concerns — `SmsModule` reaches
 * members on their phones, `WebsocketModule` reaches staff at their desks. They
 * are separate modules rather than folders because they have genuinely
 * different dependencies: one needs an HTTP client and a vendor key, the other
 * needs JWT verification and a socket server. Keeping them apart means adding a
 * third channel later touches neither.
 *
 * `@Global` because notifying is a cross-cutting consequence — memberships,
 * payments and check-ins all do it, and threading an import through every one
 * of them buys nothing.
 *
 * Only `NotificationsService` is exported. Nothing outside gets the gateway or
 * a sender, so the guarantees those two make — the test allowlist, the
 * never-throws rule — cannot be routed around.
 */
@Global()
@Module({
  imports: [SmsModule, WebsocketModule],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}

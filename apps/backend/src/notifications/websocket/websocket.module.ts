import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

import { NotificationsGateway } from './notifications.gateway';

/**
 * The staff-facing socket, and the token verification it needs.
 *
 * `JwtModule` is registered here rather than by importing `AuthModule`, because
 * the gateway needs to *verify* a staff token and nothing else. Importing the
 * auth module for that would drag the whole login flow into the dependency
 * graph of every feature that only wanted to push a line to the front desk.
 */
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
      }),
    }),
  ],
  providers: [NotificationsGateway],
  exports: [NotificationsGateway],
})
export class WebsocketModule {}

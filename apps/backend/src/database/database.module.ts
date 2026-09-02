import {
  Global,
  Inject,
  Module,
  type OnApplicationShutdown,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createDatabaseClient, type DatabaseClient } from './database.client';
import { DATABASE_CLIENT, DRIZZLE } from './database.constants';

@Global()
@Module({
  providers: [
    {
      provide: DATABASE_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService): DatabaseClient =>
        createDatabaseClient(config.getOrThrow<string>('DATABASE_URL')),
    },
    {
      provide: DRIZZLE,
      inject: [DATABASE_CLIENT],
      useFactory: (client: DatabaseClient) => client.db,
    },
  ],
  exports: [DRIZZLE],
})
export class DatabaseModule implements OnApplicationShutdown {
  constructor(
    @Inject(DATABASE_CLIENT) private readonly client: DatabaseClient,
  ) {}

  async onApplicationShutdown(): Promise<void> {
    await this.client.pool.end();
  }
}

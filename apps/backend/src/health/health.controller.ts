import { Controller, Get, Inject } from '@nestjs/common';
import { count, sql } from 'drizzle-orm';
import { Public } from '../auth/decorators/public.decorator';
import type { Database } from '../database/database.client';
import { DRIZZLE } from '../database/database.constants';
import { users } from '../database/schema';

@Controller('health')
export class HealthController {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  // A liveness probe must answer without credentials.
  @Public()
  @Get()
  async check() {
    await this.db.execute(sql`select 1`);
    const [row] = await this.db.select({ count: count() }).from(users);

    return { status: 'ok', database: 'up', users: row.count };
  }
}

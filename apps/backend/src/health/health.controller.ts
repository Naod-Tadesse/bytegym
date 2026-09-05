import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { count, sql } from 'drizzle-orm';
import { Public } from '../auth/decorators/public.decorator';
import type { Database } from '../database/database.client';
import { DRIZZLE } from '../database/database.constants';
import { person } from '../database/schema';
import { HealthCheckDto } from './dto/health-response.dto';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  // A liveness probe must answer without credentials.
  @Public()
  @Get()
  @ApiOperation({
    summary: 'Liveness probe',
    description:
      'Unauthenticated. Runs `select 1` and counts person rows, so a 200 ' +
      'proves the database connection works and not merely that the process ' +
      'is up.',
  })
  @ApiOkResponse({ type: HealthCheckDto })
  async check() {
    await this.db.execute(sql`select 1`);
    const [row] = await this.db.select({ count: count() }).from(person);

    // The wire field stays `users` — renaming it is not part of this phase.
    return { status: 'ok', database: 'up', users: row.count };
  }
}

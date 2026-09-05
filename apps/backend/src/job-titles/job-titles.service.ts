import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { eq, ilike, sql } from 'drizzle-orm';

import { countOf, paginated, toOffset } from '../common/paginate';
import type { PaginationDto } from '../common/pagination.dto';
import type { Database } from '../database/database.client';
import { DRIZZLE } from '../database/database.constants';
import * as schema from '../database/schema';

/**
 * Read-only on purpose. The catalogue lives in database/job-titles.data.ts and
 * is applied by the seed — there is no create or update, for the same reason
 * there is no API to create a permission: application code branches on these,
 * so a user-typed row would silently get none of the behaviour attached to the
 * one it was meant to be.
 */
@Injectable()
export class JobTitlesService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async findAll(query: PaginationDto) {
    const { page, limit, offset } = toOffset(query.page, query.limit);

    const where = query.search
      ? ilike(schema.jobTitles.name, `%${query.search}%`)
      : undefined;

    const [data, countRows] = await Promise.all([
      this.db
        .select()
        .from(schema.jobTitles)
        .where(where)
        .limit(limit)
        .offset(offset)
        .orderBy(schema.jobTitles.name),
      this.db
        .select({ count: sql<number>`count(*)` })
        .from(schema.jobTitles)
        .where(where),
    ]);

    return paginated(data, countOf(countRows), page, limit);
  }

  async findOne(id: string) {
    const [jobTitle] = await this.db
      .select()
      .from(schema.jobTitles)
      .where(eq(schema.jobTitles.id, id));

    if (!jobTitle) {
      throw new NotFoundException('Job title not found');
    }
    return jobTitle;
  }
}

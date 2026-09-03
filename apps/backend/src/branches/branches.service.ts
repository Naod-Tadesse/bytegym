import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, ilike, ne, sql } from 'drizzle-orm';

import { countOf, paginated, toOffset } from '../common/paginate';
import type { PaginationDto } from '../common/pagination.dto';
import type { Database } from '../database/database.client';
import { DRIZZLE } from '../database/database.constants';
import * as schema from '../database/schema';
import type { CreateBranchDto, UpdateBranchDto } from './dto/branch.dto';

@Injectable()
export class BranchesService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async findAll(query: PaginationDto) {
    const { page, limit, offset } = toOffset(query.page, query.limit);

    const where = query.search
      ? ilike(schema.branches.name, `%${query.search}%`)
      : undefined;

    const [data, countRows] = await Promise.all([
      this.db
        .select()
        .from(schema.branches)
        .where(where)
        .limit(limit)
        .offset(offset)
        .orderBy(schema.branches.createdAt),
      this.db
        .select({ count: sql<number>`count(*)` })
        .from(schema.branches)
        .where(where),
    ]);

    return paginated(data, countOf(countRows), page, limit);
  }

  async findOne(id: string) {
    const [branch] = await this.db
      .select()
      .from(schema.branches)
      .where(eq(schema.branches.id, id));

    if (!branch) {
      throw new NotFoundException('Branch not found');
    }
    return branch;
  }

  async create(dto: CreateBranchDto) {
    await this.assertNameUnique(dto.name);

    const [branch] = await this.db
      .insert(schema.branches)
      .values(dto)
      .returning();
    return branch;
  }

  async update(id: string, dto: UpdateBranchDto) {
    await this.findOne(id);
    if (dto.name) {
      await this.assertNameUnique(dto.name, id);
    }

    const [branch] = await this.db
      .update(schema.branches)
      .set(dto)
      .where(eq(schema.branches.id, id))
      .returning();
    return branch;
  }

  /**
   * Branches have no deletedAt — deactivating is the delete. Staff rows keep
   * pointing at the branch so history survives.
   */
  async deactivate(id: string) {
    await this.findOne(id);

    const [branch] = await this.db
      .update(schema.branches)
      .set({ isActive: false })
      .where(eq(schema.branches.id, id))
      .returning();
    return branch;
  }

  /**
   * `lower(x) = lower(y)`, deliberately not ilike: `_` and `%` are LIKE
   * wildcards, so `Main_Branch` would collide with `MainXBranch`.
   */
  private async assertNameUnique(name: string, excludeId?: string) {
    const conditions = [sql`lower(${schema.branches.name}) = lower(${name})`];
    if (excludeId) {
      conditions.push(ne(schema.branches.id, excludeId));
    }

    const [dupe] = await this.db
      .select({ id: schema.branches.id })
      .from(schema.branches)
      .where(and(...conditions));

    if (dupe) {
      throw new ConflictException('A branch with this name already exists');
    }
  }
}

import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, eq, ilike, ne, sql } from 'drizzle-orm';

import { countOf, paginated, toOffset } from '../common/paginate';
import { isUniqueViolation } from '../common/pg-errors';
import type { Database } from '../database/database.client';
import { DRIZZLE } from '../database/database.constants';
import * as schema from '../database/schema';
import type { MembershipPlanQueryDto } from './dto/membership-plan-query.dto';
import type {
  CreateMembershipPlanDto,
  UpdateMembershipPlanDto,
} from './dto/membership-plan.dto';

const NAME_TAKEN = 'A plan with this name already exists';

/**
 * Membership plans are gym-wide: no branch scoping, because a plan is not sold
 * at one location. Nor is there a delete — see `MembershipPlansController`.
 */
@Injectable()
export class MembershipPlansService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  async findAll(query: MembershipPlanQueryDto) {
    const { page, limit, offset } = toOffset(query.page, query.limit);

    const conditions = [];
    if (query.search) {
      conditions.push(ilike(schema.membershipPlans.name, `%${query.search}%`));
    }
    // Explicitly `!== undefined`: `false` is a real filter (retired plans only),
    // and a truthiness check would silently drop it.
    if (query.isActive !== undefined) {
      conditions.push(eq(schema.membershipPlans.isActive, query.isActive));
    }
    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [data, countRows] = await Promise.all([
      this.db
        .select()
        .from(schema.membershipPlans)
        .where(where)
        .limit(limit)
        .offset(offset)
        .orderBy(schema.membershipPlans.createdAt),
      this.db
        .select({ count: sql<number>`count(*)` })
        .from(schema.membershipPlans)
        .where(where),
    ]);

    return paginated(data, countOf(countRows), page, limit);
  }

  async findOne(id: string) {
    const [plan] = await this.db
      .select()
      .from(schema.membershipPlans)
      .where(eq(schema.membershipPlans.id, id));

    if (!plan) {
      throw new NotFoundException('Membership plan not found');
    }
    return plan;
  }

  async create(dto: CreateMembershipPlanDto) {
    await this.assertNameUnique(dto.name);

    try {
      // `price` goes in as the string it arrived as — never Number(dto.price).
      const [plan] = await this.db
        .insert(schema.membershipPlans)
        .values(dto)
        .returning();
      return plan;
    } catch (error) {
      // The race the pre-check cannot cover.
      if (isUniqueViolation(error)) {
        throw new ConflictException(NAME_TAKEN);
      }
      throw error;
    }
  }

  /**
   * Editing a plan is for fixing its wording or retiring it — **not** for
   * raising the price.
   *
   * Raise a price by creating a new plan and setting `isActive: false` on the
   * old one. Memberships snapshot `price` at the moment of sale, so history
   * survives either way; but reusing one row makes reports lie about which
   * product sold in which month — every "Monthly" sale in the archive would
   * appear to have been the new product at the new price.
   */
  async update(id: string, dto: UpdateMembershipPlanDto) {
    await this.findOne(id);
    if (dto.name) {
      await this.assertNameUnique(dto.name, id);
    }

    try {
      const [plan] = await this.db
        .update(schema.membershipPlans)
        .set(dto)
        .where(eq(schema.membershipPlans.id, id))
        .returning();
      return plan;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(NAME_TAKEN);
      }
      throw error;
    }
  }

  /**
   * `lower(x) = lower(y)`, deliberately not ilike: `_` and `%` are LIKE
   * wildcards, so `Gold_Plan` would collide with `GoldXPlan`.
   */
  private async assertNameUnique(name: string, excludeId?: string) {
    const conditions = [
      sql`lower(${schema.membershipPlans.name}) = lower(${name})`,
    ];
    if (excludeId) {
      conditions.push(ne(schema.membershipPlans.id, excludeId));
    }

    const [dupe] = await this.db
      .select({ id: schema.membershipPlans.id })
      .from(schema.membershipPlans)
      .where(and(...conditions));

    if (dupe) {
      throw new ConflictException(NAME_TAKEN);
    }
  }
}

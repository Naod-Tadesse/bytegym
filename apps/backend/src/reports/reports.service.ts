import { Inject, Injectable } from '@nestjs/common';
import { and, eq, isNull, sql } from 'drizzle-orm';

import { GYM_TIME_ZONE, GYM_TODAY_SQL } from '../common/gym-day';
import type { Database } from '../database/database.client';
import { DRIZZLE } from '../database/database.constants';
import { membershipStatusOf } from '../database/membership-status';
import * as schema from '../database/schema';

/**
 * The member's derived state, as one expression the counts can be bucketed by.
 * The same derivation the members list and the door use — see
 * `membershipStatusOf`. Counting with a second, hand-written copy is how a
 * dashboard ends up reporting a different number of active members than the
 * page it links to.
 */
const status = membershipStatusOf(schema.member.personId);

/** `count(*) filter (where …)` as a number, not the string Postgres returns. */
const countWhere = (condition: ReturnType<typeof sql>) =>
  sql<number>`count(*) filter (where ${condition})::int`;

@Injectable()
export class ReportsService {
  constructor(@Inject(DRIZZLE) private readonly db: Database) {}

  /**
   * The numbers behind the dashboard, in three aggregate queries.
   *
   * Aggregated in SQL rather than by paging the list endpoints and counting in
   * the browser: a page is not the population, so counting one would report the
   * gym's active members as "however many fit on screen".
   */
  async dashboard(scope: string | null) {
    const [members, checkIns, payments] = await Promise.all([
      this.memberCounts(scope),
      this.checkInsToday(scope),
      this.paymentsToday(scope),
    ]);

    return { members, checkInsToday: checkIns, paymentsToday: payments };
  }

  /** Every member bucketed by the state the front desk acts on. */
  private async memberCounts(scope: string | null) {
    const [row] = await this.db
      .select({
        total: sql<number>`count(*)::int`,
        active: countWhere(sql`${status} = 'active'`),
        expired: countWhere(sql`${status} = 'expired'`),
        never: countWhere(sql`${status} = 'never'`),
        /**
         * Nothing running today: the people to sell to.
         * Summed here rather than left to the caller so "inactive" has one
         * definition — `suspended` is a separate axis entirely and is
         * deliberately not folded in.
         */
        inactive: countWhere(sql`${status} in ('expired', 'never')`),
        /**
         * Barred from the premises, whatever their cover. Overlaps every
         * bucket above on purpose — being suspended is a decision about the
         * person, not a billing state, so it is counted alongside rather than
         * carved out of them.
         */
        suspended: countWhere(sql`${schema.member.isSuspended}`),
      })
      .from(schema.member)
      // Soft-deleted people are not members any more. The join is what applies
      // it: `deleted_at` lives on `person`, not on the profile row.
      .innerJoin(
        schema.person,
        and(
          eq(schema.person.id, schema.member.personId),
          isNull(schema.person.deletedAt),
        ),
      )
      .where(scope ? eq(schema.member.branchId, scope) : undefined);

    return row;
  }

  /** Visits recorded on the gym's today — one per member, by the unique index. */
  private async checkInsToday(scope: string | null) {
    const [row] = await this.db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.checkIns)
      .where(
        and(
          eq(schema.checkIns.checkedInOn, GYM_TODAY_SQL),
          scope ? eq(schema.checkIns.branchId, scope) : undefined,
        ),
      );

    return row?.count ?? 0;
  }

  /**
   * What the till has taken today, and how many payments make it up.
   *
   * `received_at` is a `timestamptz`, so it is shifted into the gym's zone
   * before being truncated — the same rule the payments list uses. Voided rows
   * are excluded: the money went back.
   *
   * `coalesce(..., 0)::numeric(12,2)` so an empty day is the string `"0.00"`,
   * not `null` — the caller renders money without a special case, and the sum
   * never becomes a JS float.
   */
  private async paymentsToday(scope: string | null) {
    const [row] = await this.db
      .select({
        count: sql<number>`count(*)::int`,
        received: sql<string>`coalesce(sum(${schema.payments.amount}), 0)::numeric(12,2)`,
      })
      .from(schema.payments)
      .where(
        and(
          sql`(${schema.payments.receivedAt} at time zone ${GYM_TIME_ZONE}::text)::date = ${GYM_TODAY_SQL}`,
          isNull(schema.payments.voidedAt),
          scope ? eq(schema.payments.branchId, scope) : undefined,
        ),
      );

    return row ?? { count: 0, received: '0.00' };
  }
}

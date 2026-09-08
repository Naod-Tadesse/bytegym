import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, isNull, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import { assertInScope } from '../common/branch-scope';
import { GYM_TIME_ZONE } from '../common/gym-day';
import { countOf, paginated, toOffset } from '../common/paginate';
import type { Database } from '../database/database.client';
import { DRIZZLE } from '../database/database.constants';
import * as schema from '../database/schema';
import { MembersService } from '../members/members.service';
import { MembershipsService } from '../memberships/memberships.service';
import type { PaymentQueryDto, RecordPaymentDto } from './dto/payment.dto';

const NOT_FOUND = 'Payment not found';
const ALREADY_VOIDED = 'This payment has already been voided';
const WRONG_MEMBER = 'That membership belongs to a different member';

/**
 * Three people can appear on one payment row and two of them are staff, so
 * `person` is joined three times and two of those need names of their own.
 * `payments.received_by_staff_id` points at `staff.person_id`, which is itself
 * `person.id`, so this reaches both names without joining `staff` at all.
 */
const cashier = alias(schema.person, 'cashier');
const voider = alias(schema.person, 'voider');

/**
 * Written out twice rather than through a helper: an alias carries its own name
 * in its type, so `cashier` and `voider` are genuinely different types and a
 * shared function would have to be generic over the alias to say so.
 *
 * `||` propagates NULL, so a left-join miss yields null rather than the string
 * `" "` — which is what the nullable `receivedByName`/`voidedByName` mean.
 */
const receivedByName = sql<
  string | null
>`${cashier.firstName} || ' ' || ${cashier.lastName}`;

const voidedByName = sql<
  string | null
>`${voider.firstName} || ' ' || ${voider.lastName}`;

/**
 * The gym day a payment belongs to.
 *
 * `received_at` is a `timestamptz`, so truncating it to a date uses the
 * session's timezone — UTC on the server. Addis is UTC+3, so a payment taken
 * at 01:00 would be filed under the previous day and drop out of the shift its
 * cashier actually worked. Shifting into the gym's zone first is what makes
 * `from`/`to` mean the days a receptionist means.
 */
const receivedOn = sql`(${schema.payments.receivedAt} at time zone ${GYM_TIME_ZONE}::text)::date`;

/** What every payment response carries. Kept in step with PaymentDto by hand. */
const paymentColumns = {
  id: schema.payments.id,
  memberId: schema.payments.memberId,
  // The member's own person row, joined directly: payments.member_id points at
  // member.person_id, which is person.id, so the `member` table adds nothing.
  memberName: sql<string>`${schema.person.firstName} || ' ' || ${schema.person.lastName}`,
  membershipId: schema.payments.membershipId,
  branchId: schema.payments.branchId,
  branchName: schema.branches.name,
  amount: schema.payments.amount,
  method: schema.payments.method,
  reference: schema.payments.reference,
  note: schema.payments.note,
  receivedByName,
  receivedAt: schema.payments.receivedAt,
  voidedAt: schema.payments.voidedAt,
  voidReason: schema.payments.voidReason,
  voidedByName,
};

/**
 * Money received, and the only table here that is never deleted — a mistake is
 * voided instead, and the voided row stays in every list. Hence no `update`
 * and no `remove`: the amount, the method and the payer are what happened, and
 * editing them would rewrite history rather than record a correction.
 */
@Injectable()
export class PaymentsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    // Both are here for their branch-scope 404s: resolving the member and the
    // membership through the services that own them is what stops a filter on
    // another branch's id returning an empty list that reads as "no payments".
    private readonly membersService: MembersService,
    private readonly membershipsService: MembershipsService,
  ) {}

  /**
   * Newest first, with the shift total beside the page.
   *
   * **Voided payments are not filtered out.** They are the rows a
   * reconciliation needs most — 800 taken and then reversed, by whom and why —
   * and a `deleted_at`-style read filter would hide exactly that. Only
   * `totals.received` excludes them.
   *
   * Nor does this filter `person.deleted_at`, unlike every other list: money
   * taken from someone who has since been removed was still in the drawer, and
   * dropping it would make the day's takings stop adding up.
   */
  async findAll(query: PaymentQueryDto, scope: string | null) {
    const { page, limit, offset } = toOffset(query.page, query.limit);

    // Annotated because it starts empty: every other list here opens with a
    // soft-delete filter, and this one deliberately has none.
    const conditions: SQL[] = [];
    // `null` scope means every branch — see branchScopeOf.
    if (scope) {
      conditions.push(eq(schema.payments.branchId, scope));
    }
    // Both conditions stand: a branch-scoped caller naming another branch gets
    // an empty page rather than that branch's takings.
    if (query.branchId) {
      conditions.push(eq(schema.payments.branchId, query.branchId));
    }
    if (query.memberId) {
      // 404s an out-of-scope member instead of returning an empty history,
      // which would read as "they have never paid anything".
      await this.membersService.findOne(query.memberId, scope);
      conditions.push(eq(schema.payments.memberId, query.memberId));
    }
    if (query.membershipId) {
      await this.membershipsService.findOne(query.membershipId, scope);
      conditions.push(eq(schema.payments.membershipId, query.membershipId));
    }
    if (query.planId) {
      // EXISTS rather than a join, so the count-and-total query below stays a
      // single scan of `payments`. A payment has no plan of its own — it is the
      // plan of the membership it settles, which is why this reaches through.
      conditions.push(sql`exists (
        select 1 from ${schema.memberships} m
        where m.id = ${schema.payments.membershipId}
          and m.plan_id = ${query.planId})`);
    }
    if (query.method) {
      conditions.push(eq(schema.payments.method, query.method));
    }
    if (query.search) {
      // Same reach-through, and the same reason. A payment carries no text of
      // its own, so a search is a search of the person who made it.
      const term = `%${query.search}%`;
      conditions.push(sql`exists (
        select 1 from ${schema.person} p
        join ${schema.member} mb on mb.person_id = p.id
        where p.id = ${schema.payments.memberId}
          and (p.first_name ilike ${term}
            or p.last_name ilike ${term}
            or p.phone ilike ${term}
            or mb.member_code ilike ${term}))`);
    }
    // Inclusive both ends, and both in the gym's own day — see receivedOn.
    if (query.from) {
      conditions.push(sql`${receivedOn} >= ${query.from}`);
    }
    if (query.to) {
      conditions.push(sql`${receivedOn} <= ${query.to}`);
    }
    const where = and(...conditions);

    const [data, summaryRows] = await Promise.all([
      this.baseQuery()
        .where(where)
        .limit(limit)
        .offset(offset)
        // Newest first. The id breaks ties so paging stays deterministic when
        // two payments land in the same millisecond.
        .orderBy(desc(schema.payments.receivedAt), desc(schema.payments.id)),
      // Still no joins: `planId` and `search` reach through EXISTS rather than
      // widening the FROM, so the count and the total stay one extra scan of
      // `payments` rather than a repeat of the whole query.
      this.db
        .select({
          count: sql<number>`count(*)`,
          // The number the drawer is counted against, so it is a SUM over the
          // whole filter rather than over the page. FILTER, not a WHERE, so
          // voided rows still count toward `meta.total` while contributing
          // nothing here. The cast is what makes an empty result "0.00"
          // instead of "0" — a money string always carries its two decimals.
          received: sql<string>`coalesce(sum(${schema.payments.amount}) filter (where ${schema.payments.voidedAt} is null), 0)::numeric(12,2)`,
        })
        .from(schema.payments)
        .where(where),
    ]);

    return {
      ...paginated(data, countOf(summaryRows), page, limit),
      totals: { received: summaryRows[0]?.received ?? '0.00' },
    };
  }

  /**
   * `scope` defaults to null (unrestricted) for internal callers that have
   * already checked access — record and void re-read the row they just wrote.
   */
  async findOne(id: string, scope: string | null = null) {
    const [row] = await this.baseQuery().where(eq(schema.payments.id, id));

    if (!row) {
      throw new NotFoundException(NOT_FOUND);
    }
    // 404 rather than 403, so the endpoint cannot be used to discover which
    // ids exist at other branches.
    assertInScope(scope, row.branchId, NOT_FOUND);

    return row;
  }

  /**
   * Takes money against a membership — **the instalment path**.
   *
   * The full amount at the moment of sale is `POST /memberships` with a
   * `payment`, which prices it server-side and writes both rows in one
   * transaction. This endpoint exists for the rest: 800 now, the remainder on
   * Friday, which is why it carries an amount of its own.
   *
   * Deliberately not wrapped in a transaction: one INSERT into one table is
   * already atomic, and nothing else is written. The balance it moves is a
   * SUM computed on read, so there is no second row to keep in step.
   */
  async record(
    dto: RecordPaymentDto,
    actorStaffId: string,
    scope: string | null,
  ) {
    // 404s if the member sits at another branch.
    const member = await this.membersService.findOne(dto.memberId, scope);

    // No longer conditional: every payment settles a membership, so this is
    // also a 404 for a membership at another branch.
    const membership = await this.membershipsService.findOne(
      dto.membershipId,
      scope,
    );
    // Otherwise a typo credits one member's money against another's
    // balance, and both readings look plausible on their own screen.
    if (membership.memberId !== dto.memberId) {
      throw new BadRequestException(WRONG_MEMBER);
    }

    const [created] = await this.db
      .insert(schema.payments)
      .values({
        memberId: member.personId,
        membershipId: membership.id,
        // The member's home gym, never the request body: a cashier does not
        // get to say which drawer the money landed in.
        branchId: member.branchId,
        amount: dto.amount,
        method: dto.method,
        reference: dto.reference,
        note: dto.note,
        // From the access token, never the request body.
        receivedByStaffId: actorStaffId,
      })
      .returning({ id: schema.payments.id });

    return this.findOne(created.id);
  }

  /**
   * Reverses a payment without removing it.
   *
   * The pre-check gives the common case its message; the `voided_at is null`
   * in the UPDATE is the actual guard, exactly as a unique index is for a
   * uniqueness pre-check. Two clicks arriving together would both pass the
   * read — under READ COMMITTED neither sees the other's write — and the
   * second would silently overwrite the first's reason and cashier. Here it
   * updates no rows and gets the same 409 a human would.
   */
  async void(
    id: string,
    reason: string,
    actorStaffId: string,
    scope: string | null,
  ) {
    // 404s if the payment was taken at another branch.
    const payment = await this.findOne(id, scope);
    if (payment.voidedAt) {
      throw new ConflictException(ALREADY_VOIDED);
    }

    const updated = await this.db
      .update(schema.payments)
      .set({
        voidedAt: new Date(),
        voidedByStaffId: actorStaffId,
        voidReason: reason,
      })
      .where(and(eq(schema.payments.id, id), isNull(schema.payments.voidedAt)))
      .returning({ id: schema.payments.id });

    if (updated.length === 0) {
      throw new ConflictException(ALREADY_VOIDED);
    }

    return this.findOne(id);
  }

  /**
   * The joins every read shares.
   *
   * The member's person row is an inner join — a payment cannot exist without
   * a payer — but both staff joins are left joins: a payment outliving the
   * staff record that took it must still render, with a null name rather than
   * vanishing from the reconciliation. `voider` is null on every live payment
   * by definition.
   */
  private baseQuery() {
    return this.db
      .select(paymentColumns)
      .from(schema.payments)
      .innerJoin(schema.person, eq(schema.person.id, schema.payments.memberId))
      .innerJoin(
        schema.branches,
        eq(schema.branches.id, schema.payments.branchId),
      )
      .leftJoin(cashier, eq(cashier.id, schema.payments.receivedByStaffId))
      .leftJoin(voider, eq(voider.id, schema.payments.voidedByStaffId));
  }
}

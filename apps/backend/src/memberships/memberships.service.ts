import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { and, desc, eq, isNull, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import { addDaysISO, gymToday } from '../common/gym-day';
import { countOf, paginated, toOffset } from '../common/paginate';
import { isExclusionViolation } from '../common/pg-errors';
import type { Database, Transaction } from '../database/database.client';
import { DRIZZLE } from '../database/database.constants';
import * as schema from '../database/schema';
import { MembersService } from '../members/members.service';
import type {
  MembershipQueryDto,
  SellMembershipDto,
} from './dto/membership.dto';

/** Taking money has its own permission, even inside a sale. */
const PAYMENT_PERMISSION = 'payment.record';

const OVERLAPS =
  'This member already has a membership covering some of those dates';
const COMPLIMENTARY_IS_UNPAID =
  'A complimentary membership owes nothing, so no payment can be taken for it';
const NOTHING_TO_PAY =
  'This membership costs nothing, so no payment can be taken for it';

/**
 * Zero as a `numeric(12,2)` string — `"0"`, `"0.00"`, `"000"`.
 *
 * A regex rather than `Number(x) === 0` for the same reason the column is a
 * string: money never becomes a float here, not even to be compared.
 */
const isZeroMoney = (amount: string): boolean => /^0+(\.0+)?$/.test(amount);

/**
 * The seller's person row. Aliased because `person` is already joined once, for
 * the member — two joins on one table need two names.
 *
 * `memberships.sold_by_staff_id` points at `staff.person_id`, which is itself
 * `person.id`, so this reaches the name without joining `staff` at all.
 */
const seller = alias(schema.person, 'seller');

/**
 * `soldByName` is null exactly when `soldByStaffId` is: `||` propagates NULL,
 * so a left-join miss yields null rather than the string " ".
 */
const soldByName = sql<
  string | null
>`${seller.firstName} || ' ' || ${seller.lastName}`;

/**
 * What has actually been paid against this membership — **derived, never
 * stored**.
 *
 * A stored running total would need every payment write, and every void, to
 * remember to update it; the day one path forgets, the column lies while the
 * front desk trusts it. This cannot go stale: it is the payment rows
 * themselves.
 *
 * `voided_at is null` is the only place voided payments are excluded — they
 * stay visible everywhere else, because a reversal is part of the record.
 *
 * The `::numeric(12,2)` is not cosmetic: `coalesce(sum(...), 0)` on a member
 * who has paid nothing yields the integer-ish `0`, which reaches the client as
 * `"0"` while every other money string carries two decimals. Money formatting
 * on the client would then have a special case for exactly the row a
 * receptionist is most likely to be looking at.
 */
const paidTotal = sql<string>`coalesce((
  select sum(p.amount) from ${schema.payments} p
  where p.membership_id = ${schema.memberships.id}
    and p.voided_at is null), 0)::numeric(12,2)`;

/**
 * What this sale was worth: the plan's price plus the joining fee, both
 * snapshots on the row.
 *
 * Exposed rather than left for the client to add up. Two money strings summed
 * in JS is exactly the float arithmetic the `numeric(12,2)`-as-string rule
 * exists to prevent, and the moment a second surcharge appears every caller
 * that re-derived it is quietly wrong.
 *
 * A COMPLIMENTARY membership still reports what it was worth — that is the
 * value given away, and it is what makes comps reportable. What it does not
 * report is a debt; see `balance`.
 */
const amountDue = sql<string>`(${schema.memberships.price}
  + ${schema.memberships.registrationFee})::numeric(12,2)`;

/**
 * What is still owed: the amount due minus what has been paid.
 *
 * Goes negative on an overpayment, which is deliberate — nothing caps a
 * payment at the outstanding amount, and hiding the excess behind a zero would
 * lose money the gym actually owes back.
 *
 * A COMPLIMENTARY membership owes nothing, whatever its price and joining fee
 * say. Both are still snapshotted, because the value of what was given away is
 * worth reporting, but subtracting payments from them would bill a staff
 * member who trains free for the full amount. Answering "owed" honestly here is
 * what lets the UI colour any positive balance red without special-casing
 * comps — and folding the registration fee in above is what keeps that true
 * now that a first sale costs more than the plan.
 */
const balance = sql<string>`(case
  when ${schema.memberships.isComplimentary} then 0
  else ${schema.memberships.price} + ${schema.memberships.registrationFee}
    - coalesce((
      select sum(p.amount) from ${schema.payments} p
      where p.membership_id = ${schema.memberships.id}
        and p.voided_at is null), 0)
end)::numeric(12,2)`;

/** What every membership response carries. Kept in step with MembershipDto by hand. */
const membershipColumns = {
  id: schema.memberships.id,
  memberId: schema.memberships.memberId,
  planId: schema.memberships.planId,
  planName: schema.membershipPlans.name,
  startsOn: schema.memberships.startsOn,
  endsOn: schema.memberships.endsOn,
  // The snapshot on the membership row, NOT membershipPlans.price. Joining the
  // plan for the price is the one mistake this column exists to prevent. The
  // same goes for the joining fee beside it.
  price: schema.memberships.price,
  registrationFee: schema.memberships.registrationFee,
  // price + registrationFee, added in SQL so no caller adds money in JS.
  amountDue,
  // Both computed per read from the payments table — see above.
  paidTotal,
  balance,
  isComplimentary: schema.memberships.isComplimentary,
  soldByStaffId: schema.memberships.soldByStaffId,
  soldByName,
  createdAt: schema.memberships.createdAt,
};

/**
 * Memberships are sold and voided, never edited — so there is no update and no
 * remove here. Correcting a mistaken sale is a phase-4 void, which travels with
 * the payment.
 */
@Injectable()
export class MembershipsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    // Resolving the member through this service is what makes an out-of-scope
    // member 404 rather than leak through an empty list.
    private readonly membersService: MembersService,
  ) {}

  async findAll(query: MembershipQueryDto, scope: string | null) {
    const { page, limit, offset } = toOffset(query.page, query.limit);

    const conditions = [
      isNull(schema.memberships.deletedAt),
      // Removed members drop out of every list; the member row survives so the
      // rows still join, which is why this filters person rather than member.
      isNull(schema.person.deletedAt),
    ];
    // `null` scope means every branch — see branchScopeOf. A membership has no
    // branch of its own: it scopes through the member's home gym.
    if (scope) {
      conditions.push(eq(schema.member.branchId, scope));
    }
    if (query.memberId) {
      // 404s an out-of-scope member instead of returning an empty history,
      // which would read as "they have never bought anything".
      await this.membersService.findOne(query.memberId, scope);
      conditions.push(eq(schema.memberships.memberId, query.memberId));
    }
    const where = and(...conditions);

    const [data, countRows] = await Promise.all([
      this.baseQuery()
        .where(where)
        .limit(limit)
        .offset(offset)
        // Newest first: the current period is the one the front desk wants.
        .orderBy(desc(schema.memberships.createdAt)),
      this.db
        .select({ count: sql<number>`count(*)` })
        .from(schema.memberships)
        .innerJoin(
          schema.member,
          eq(schema.member.personId, schema.memberships.memberId),
        )
        .innerJoin(schema.person, eq(schema.person.id, schema.member.personId))
        .where(where),
    ]);

    return paginated(data, countOf(countRows), page, limit);
  }

  /**
   * `scope` defaults to null (unrestricted) for internal callers that have
   * already checked access — `sell` re-reads the row it just wrote.
   *
   * The scope check is a WHERE clause rather than an `assertInScope` on the
   * selected row, so `member.branch_id` never enters the projection and cannot
   * leak onto the wire: a membership scopes through its member and must not
   * carry a second copy of that branch. The behaviour is the same one
   * `assertInScope` gives — 404, not 403, so the endpoint cannot be used to
   * discover which ids exist at other branches.
   */
  async findOne(id: string, scope: string | null = null) {
    return this.findOneWith(this.db, id, scope);
  }

  /**
   * Takes the connection so the sale can re-read the row it has just written.
   * Calling the `this.db` version from inside the transaction would run on a
   * different pooled connection and find nothing — the membership and its
   * payment are not committed yet.
   */
  private async findOneWith(
    db: Database | Transaction,
    id: string,
    scope: string | null = null,
  ) {
    const conditions = [
      eq(schema.memberships.id, id),
      isNull(schema.memberships.deletedAt),
      isNull(schema.person.deletedAt),
    ];
    if (scope) {
      conditions.push(eq(schema.member.branchId, scope));
    }

    const [row] = await this.baseQuery(db).where(and(...conditions));

    if (!row) {
      throw new NotFoundException('Membership not found');
    }
    return row;
  }

  /**
   * Sells a period of cover, **and takes the money for it in the same
   * transaction**.
   *
   * Selling and paying are one act at the desk, so they are one write here: a
   * membership with a payment that failed to land would read as an unpaid
   * balance nobody owes, and a payment whose membership rolled back would be
   * money credited to nothing. Two tables, therefore one `db.transaction`, and
   * every read inside it uses `tx` — a sibling method closing over `this.db`
   * would run on a different pooled connection and never see these rows.
   *
   * **There is no amount in the body.** It is `price + registration_fee`,
   * computed by Postgres from the row just written, which is what makes "no
   * manual amount" true and also means a caller cannot under-charge by editing
   * a number on the way in.
   *
   * The overlap check is still the exclusion constraint, not a pre-check. A
   * SELECT followed by an INSERT is the same TOCTOU race as a uniqueness
   * pre-check — two receptionists selling at once both see no overlap under
   * READ COMMITTED — and a transaction does not fix that. The constraint does,
   * so the only work here is translating its error to the right status.
   */
  async sell(
    dto: SellMembershipDto,
    actorStaffId: string,
    scope: string | null,
    actorPermissions: string[],
  ) {
    // Selling and taking the money are two acts, and only one of them is
    // `membership.sell`. Without this, anyone who can sell could record a
    // payment simply by attaching one — routing around the permission that
    // exists to gate cash. Checked here rather than as a second @Permissions()
    // on the route, because it applies only when `payment` is actually sent.
    if (dto.payment && !actorPermissions.includes(PAYMENT_PERMISSION)) {
      throw new ForbiddenException(`Missing permission: ${PAYMENT_PERMISSION}`);
    }
    // 404s if the member sits at another branch. Outside the transaction on
    // purpose: it is the access check, and a rejected sale should not have
    // opened one.
    const member = await this.membersService.findOne(dto.memberId, scope);

    const [plan] = await this.db
      .select()
      .from(schema.membershipPlans)
      .where(eq(schema.membershipPlans.id, dto.planId));

    // 400 rather than 404: from the caller's point of view this is a bad
    // request body, and a retired plan is not missing — it is unsellable.
    if (!plan) {
      throw new BadRequestException('Membership plan not found');
    }
    if (!plan.isActive) {
      throw new BadRequestException(
        'This plan has been retired and can no longer be sold',
      );
    }

    const isComplimentary = dto.isComplimentary ?? false;
    // Nothing is owed, so there is nothing to take. Refusing is what stops a
    // comp quietly carrying a receipt for money that never changed hands.
    if (isComplimentary && dto.payment) {
      throw new BadRequestException(COMPLIMENTARY_IS_UNPAID);
    }

    // The gym's local date, not UTC: Addis is UTC+3, so between midnight and
    // 03:00 a UTC "today" is still yesterday and would sell a day short.
    const startsOn = dto.startsOn ?? gymToday();
    // ends_on is INCLUSIVE, so a 30-day plan starting today ends on day 29.
    const endsOn = addDaysISO(startsOn, plan.durationDays - 1);

    try {
      return await this.db.transaction(async (tx) => {
        // Locks the member row for the rest of the transaction, which is the
        // only thing that makes "have they ever bought before" safe to act on.
        // Two sales to the same brand-new member landing together would both
        // count zero prior memberships under READ COMMITTED and both charge
        // the joining fee; the exclusion constraint does not catch it, because
        // September and October do not overlap. No constraint can express
        // "at most one registration fee per member", so this lock is the
        // guard. It also gives the branch as of inside the transaction.
        const [locked] = await tx
          .select({ branchId: schema.member.branchId })
          .from(schema.member)
          .where(eq(schema.member.personId, member.personId))
          .for('update');

        // Read inside the transaction, under the lock — reading it outside
        // would leave a gap in which the member's first membership appears.
        const priorRows = await tx
          .select({ count: sql<number>`count(*)` })
          .from(schema.memberships)
          .where(
            and(
              eq(schema.memberships.memberId, member.personId),
              // Voided sales do not count as having joined: the payment that
              // went with one was reversed too, so the fee was refunded.
              isNull(schema.memberships.deletedAt),
            ),
          );
        const isFirstEver = countOf(priorRows) === 0;

        const [created] = await tx
          .insert(schema.memberships)
          .values({
            memberId: member.personId,
            planId: plan.id,
            startsOn,
            endsOn,
            // SNAPSHOT. Repricing or retiring the plan later must not rewrite
            // what this member paid.
            price: plan.price,
            // Also a snapshot, and zero for anyone who has bought before —
            // decided here, never from a flag in the body.
            registrationFee: isFirstEver ? plan.registrationFee : '0',
            isComplimentary,
            // From the access token, never the request body.
            soldByStaffId: actorStaffId,
          })
          .returning({
            id: schema.memberships.id,
            // Added by Postgres from the row it just wrote. Summing two
            // numeric strings in JS is the float bug the string typing exists
            // to prevent, and this cannot drift from what the balance uses.
            amountDue: sql<string>`(${schema.memberships.price}
              + ${schema.memberships.registrationFee})::numeric(12,2)`,
          });

        if (dto.payment) {
          // Only reachable for a free plan with no joining fee, and a zero row
          // in the ledger looks like a receipt for money nobody handed over.
          if (isZeroMoney(created.amountDue)) {
            throw new BadRequestException(NOTHING_TO_PAY);
          }

          await tx.insert(schema.payments).values({
            memberId: member.personId,
            membershipId: created.id,
            // The member's home gym, never the request body: a cashier does
            // not get to say which drawer the money landed in.
            branchId: locked.branchId,
            // The full amount due. The instalment path is POST /payments,
            // which is where a partial figure is the whole point.
            amount: created.amountDue,
            method: dto.payment.method,
            reference: dto.payment.reference,
            note: dto.payment.note,
            // From the access token, never the request body.
            receivedByStaffId: actorStaffId,
          });
        }

        // `tx`, not `this.db`: the rows above are not committed yet.
        return this.findOneWith(tx, created.id);
      });
    } catch (error) {
      if (isExclusionViolation(error)) {
        throw new ConflictException(OVERLAPS);
      }
      throw error;
    }
  }

  /**
   * The joins every read shares. `member` is joined for the branch filter and
   * `person` for the soft-delete one, even though neither contributes a column.
   */
  private baseQuery(db: Database | Transaction = this.db) {
    return db
      .select(membershipColumns)
      .from(schema.memberships)
      .innerJoin(
        schema.member,
        eq(schema.member.personId, schema.memberships.memberId),
      )
      .innerJoin(schema.person, eq(schema.person.id, schema.member.personId))
      .innerJoin(
        schema.membershipPlans,
        eq(schema.membershipPlans.id, schema.memberships.planId),
      )
      .leftJoin(seller, eq(seller.id, schema.memberships.soldByStaffId));
  }
}

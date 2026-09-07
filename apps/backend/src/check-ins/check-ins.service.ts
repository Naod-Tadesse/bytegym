import {
  ForbiddenException,
  HttpStatus,
  Inject,
  Injectable,
} from '@nestjs/common';
import { and, desc, eq, gte, isNull, lte, sql, type SQL } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

import type { AuthenticatedUser } from '../auth/auth.types';
import { branchScopeOf } from '../common/branch-scope';
import type { CheckInRefusalReason, MembershipStatus } from '../common/enums';
import { gymToday } from '../common/gym-day';
import { countOf, paginated, toOffset } from '../common/paginate';
import { isUniqueViolation } from '../common/pg-errors';
import type { Database } from '../database/database.client';
import { DRIZZLE } from '../database/database.constants';
import * as schema from '../database/schema';
import { MembersService } from '../members/members.service';
import type { CheckInQueryDto, RecordCheckInDto } from './dto/check-in.dto';

/** The permission that waves a member in with nothing covering the day. */
const OVERRIDE_PERMISSION = 'checkin.override';

const SUSPENDED = 'This member is suspended';
const NO_MEMBERSHIP = 'This member has no membership';

/**
 * Two people can appear on one check-in and neither is the member, so `person`
 * is joined twice more under aliases. `check_ins.override_by_staff_id` points
 * at `staff.person_id`, which is itself `person.id`, so this reaches the name
 * without joining `staff` at all.
 */
const recorder = alias(schema.person, 'recorder');
const overrider = alias(schema.person, 'overrider');

/**
 * Written out twice rather than through a helper: an alias carries its own name
 * in its type, so `recorder` and `overrider` are genuinely different types and
 * a shared function would have to be generic over the alias to say so.
 *
 * `||` propagates NULL, so a left-join miss yields null rather than the string
 * `" "` — which is what the nullable `recordedByName`/`overrideByName` mean.
 */
const recordedByName = sql<
  string | null
>`${recorder.firstName} || ' ' || ${recorder.lastName}`;

const overrideByName = sql<
  string | null
>`${overrider.firstName} || ' ' || ${overrider.lastName}`;

/**
 * Where the member stands TODAY, not on the day they came in.
 *
 * Deliberately the same derivation as the members list rather than something
 * read off `check_ins.membership_id` — that column records which membership the
 * visit fell under at the time, and the desk scanning today's arrivals wants to
 * know who is about to lapse, not who was covered this morning. The two agree
 * on the day itself and diverge afterwards, which is the useful direction.
 */
const membershipStatus = sql<MembershipStatus>`
  case
    when not exists (select 1 from ${schema.memberships} m
                     where m.member_id = ${schema.checkIns.memberId}
                       and m.deleted_at is null) then 'never'
    when exists (select 1 from ${schema.memberships} m
                 where m.member_id = ${schema.checkIns.memberId}
                   and m.deleted_at is null
                   and current_date between m.starts_on and m.ends_on) then 'active'
    when not exists (select 1 from ${schema.memberships} m
                     where m.member_id = ${schema.checkIns.memberId}
                       and m.deleted_at is null
                       and m.starts_on <= current_date) then 'upcoming'
    else 'expired'
  end`;

/** The last day any membership covers, so the card can count down to it. */
const expiresOn = sql<string | null>`(
  select max(m.ends_on) from ${schema.memberships} m
  where m.member_id = ${schema.checkIns.memberId} and m.deleted_at is null)`;

/**
 * The first day of the membership covering today — the other end of the span
 * the desk is measuring against.
 *
 * With `expiresOn` this gives the whole stretch a member has paid for and not
 * yet used up, which is what "how far through are they" has to mean. Measuring
 * against the current period alone would get an early renewal backwards:
 * someone on 20 September who also holds October is two-thirds through
 * September but has six weeks left, and only the wider span says so.
 *
 * Null when nothing covers today, where a proportion means nothing anyway.
 */
const coverStartsOn = sql<string | null>`(
  select min(m.starts_on) from ${schema.memberships} m
  where m.member_id = ${schema.checkIns.memberId}
    and m.deleted_at is null
    and current_date between m.starts_on and m.ends_on)`;

/** What every check-in response carries. Kept in step with CheckInDto by hand. */
const checkInColumns = {
  /**
   * Cast to text in SQL, never mapped through JS. The column is a `bigserial`,
   * which Drizzle maps to a `BigInt` that `JSON.stringify` refuses outright —
   * and a plain number would silently round past 2^53. Text is the only shape
   * that survives the wire intact.
   */
  id: sql<string>`${schema.checkIns.id}::text`,
  memberId: schema.checkIns.memberId,
  // The member's own person row, joined directly: check_ins.member_id points at
  // member.person_id, which is person.id.
  memberName: sql<string>`${schema.person.firstName} || ' ' || ${schema.person.lastName}`,
  memberCode: schema.member.memberCode,
  membershipId: schema.checkIns.membershipId,
  branchId: schema.checkIns.branchId,
  branchName: schema.branches.name,
  recordedByName,
  overrideByName,
  checkedInOn: schema.checkIns.checkedInOn,
  checkedInAt: schema.checkIns.checkedInAt,
  // Derived per read, never stored — see the note above the expressions.
  membershipStatus,
  expiresOn,
  coverStartsOn,
};

/** Builds the 403 body. The prose is for people, `reason` is for the UI. */
const refusal = (reason: CheckInRefusalReason, message: string) =>
  // An object body is returned verbatim by Nest, so `statusCode` and `error`
  // have to be spelled out here or the shape would drift from every other
  // error in the API.
  new ForbiddenException({
    statusCode: HttpStatus.FORBIDDEN,
    message,
    error: 'Forbidden',
    reason,
  });

/**
 * The door.
 *
 * Append-only: no update and no delete, because attendance is a record of what
 * happened rather than a row describing a current state. There is correspondingly
 * no `deleted_at` on the table and no soft-delete filter on any read here.
 */
@Injectable()
export class CheckInsService {
  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    // For its findOne, which is where the branch-scope 404 lives — and which
    // also supplies the member's own branch and suspension flag.
    private readonly membersService: MembersService,
  ) {}

  /**
   * One gym day's attendance, newest first.
   *
   * Deliberately not filtered on `person.deleted_at`, unlike every list that
   * describes people: someone who trained this morning and was removed this
   * afternoon still trained this morning, and dropping the row would make the
   * day's attendance stop adding up. Same reasoning as the payments list.
   */
  async findAll(query: CheckInQueryDto, scope: string | null) {
    const { page, limit, offset } = toOffset(query.page, query.limit);

    // Always bounded, never "everything" — see CheckInQueryDto.from. Both ends
    // default to today, so the desk's unfiltered call is still one day while
    // the attendance screen can ask for a month.
    const today = gymToday();
    const conditions: SQL[] = [
      gte(schema.checkIns.checkedInOn, query.from ?? today),
      lte(schema.checkIns.checkedInOn, query.to ?? today),
    ];
    // `null` scope means every branch — see branchScopeOf.
    if (scope) {
      conditions.push(eq(schema.checkIns.branchId, scope));
    }
    // Both conditions stand: a branch-scoped caller naming another branch gets
    // an empty page rather than that branch's door log.
    if (query.branchId) {
      conditions.push(eq(schema.checkIns.branchId, query.branchId));
    }
    if (query.memberId) {
      // 404s an out-of-scope member instead of returning an empty list, which
      // would read as "they did not come in".
      await this.membersService.findOne(query.memberId, scope);
      conditions.push(eq(schema.checkIns.memberId, query.memberId));
    }
    const where = and(...conditions);

    const [data, countRows] = await Promise.all([
      this.baseQuery()
        .where(where)
        .limit(limit)
        .offset(offset)
        // Newest first. The id breaks ties so paging stays deterministic when
        // two turnstiles scan in the same millisecond.
        .orderBy(desc(schema.checkIns.checkedInAt), desc(schema.checkIns.id)),
      // No joins: every condition above is on `check_ins` alone, so the count
      // is one extra index scan rather than a repeat of the whole query.
      this.db
        .select({ count: sql<number>`count(*)` })
        .from(schema.checkIns)
        .where(where),
    ]);

    return paginated(data, countOf(countRows), page, limit);
  }

  /**
   * Admit a member, or refuse them and say why.
   *
   * **Idempotent, and that is the design rather than a convenience.** Members
   * leave for lunch and come back; a 409 at the desk is a worse answer than
   * none, because the person scanning has to decide whether the member is in
   * or not and an error tells them neither. So today's row is looked up first
   * and returned if it exists, and the caller tells the two apart by the HTTP
   * status: 201 recorded, 200 already there.
   *
   * The look-up runs **before** the suspension and membership checks on
   * purpose. Once someone is through the door, a second scan is a question
   * about a fact that already exists — refusing it would not un-admit them,
   * and it would make the desk's screen disagree with the attendance list.
   * Suspending someone stops the *next* day, and lifting a membership problem
   * mid-visit must not produce a second row for the same day either.
   */
  async record(dto: RecordCheckInDto, user: AuthenticatedUser) {
    const scope = branchScopeOf(user);
    // 404s if the member sits at another branch.
    const member = await this.membersService.findOne(dto.memberId, scope);
    // The gym's local date, never `toISOString().slice(0, 10)` — that is UTC,
    // and between midnight and 03:00 in Addis the two disagree.
    const today = gymToday();

    const existing = await this.findForDay(member.personId, today);
    if (existing) {
      return { created: false, row: existing };
    }

    // Checked before the membership state and **not overridable**. Being barred
    // from the premises is a manager's decision about the person; an expired
    // membership is a billing state. Letting `checkin.override` cover both
    // would put the desk in a position to reverse the manager, so the only way
    // past this is to lift the suspension on the member record.
    if (member.isSuspended) {
      throw refusal('suspended', SUSPENDED);
    }

    const cover = await this.coverFor(member.personId, today);
    // Asked for AND allowed. Both halves matter: overriding automatically for
    // anyone holding the permission would mean a manager scanning an unpaid
    // member gets a green light and is never prompted to sell a renewal, and
    // would make `override_by_staff_id` record "held the permission" rather
    // than "decided to let them in".
    const canOverride =
      dto.override === true && user.permissions.includes(OVERRIDE_PERMISSION);

    if (!cover.membershipId && !canOverride) {
      // Four distinct refusals, not two: each one is a different next action at
      // the desk. `expired` means sell them a renewal, `upcoming` means they
      // are early and must NOT be asked for money, `none` means sign them up.
      if (cover.total === 0) {
        throw refusal('none', NO_MEMBERSHIP);
      }
      if (cover.lastEndedOn) {
        throw refusal(
          'expired',
          `This membership expired on ${cover.lastEndedOn}`,
        );
      }
      throw refusal(
        'upcoming',
        `This membership starts on ${cover.nextStartsOn}`,
      );
    }

    // Past the guard with nothing covering the day means exactly one thing.
    const override = cover.membershipId === null;

    try {
      // One INSERT into one table: already atomic, so no transaction. Nothing
      // else is written — the unique index does the work a transaction could
      // not do anyway, since two concurrent scans both see no row.
      await this.db.insert(schema.checkIns).values({
        memberId: member.personId,
        // Null on an override: that is what an override is.
        membershipId: cover.membershipId,
        // The member's home gym, never the caller's branch.
        branchId: member.branchId,
        // Both from the access token, never the request body.
        recordedByPersonId: user.personId,
        overrideByStaffId: override ? user.staffId : null,
        checkedInOn: today,
      });
    } catch (error) {
      // Two turnstiles scanning at once: both passed the look-up above, one
      // inserted, this one lost. The right answer is still the row that exists,
      // not a 500 and not a 409 — the member is in either way.
      if (isUniqueViolation(error)) {
        const row = await this.findForDay(member.personId, today);
        if (row) {
          return { created: false, row };
        }
      }
      throw error;
    }

    // Re-read rather than RETURNING: the response carries four joined names the
    // insert has no access to.
    const row = await this.findForDay(member.personId, today);
    if (!row) {
      // Unreachable — the insert above committed. Explicit so the return type
      // is the row rather than "row or undefined" for every caller.
      throw new Error('Check-in was written but could not be read back');
    }

    return { created: true, row };
  }

  /**
   * Today's row for this member, or undefined.
   *
   * Keyed on `(member_id, checked_in_on)` — the unique index itself — so the
   * idempotent look-up, the post-insert read and the 23505 recovery are all the
   * same query, and none of them has to carry a `bigserial` id through JS.
   */
  private async findForDay(memberId: string, on: string) {
    const [row] = await this.baseQuery().where(
      and(
        eq(schema.checkIns.memberId, memberId),
        eq(schema.checkIns.checkedInOn, on),
      ),
    );

    return row;
  }

  /**
   * What this member's memberships say about one day, in a single round trip.
   *
   * Every non-deleted membership is one of exactly three things relative to
   * `on` — covering it, ended before it, or starting after it — because
   * `ends_on` is never before `starts_on`. So these three aggregates plus the
   * count answer both "may they train" and, when they may not, which of the
   * four refusals applies.
   *
   * `lastEndedOn` is the most recent day cover actually ran out, not
   * `max(ends_on)`: a member with a lapsed September and a booked November
   * would otherwise be told their membership "expired" on a date in the future.
   */
  private async coverFor(memberId: string, on: string) {
    const m = schema.memberships;

    const [row] = await this.db
      .select({
        // array_agg(...)[1] rather than a second query. Any covering row will
        // do — the exclusion constraint on memberships guarantees there is at
        // most one, since two covering the same day would overlap.
        membershipId: sql<string | null>`(array_agg(${m.id}) filter (
          where ${m.startsOn} <= ${on}::date and ${m.endsOn} >= ${on}::date))[1]`,
        // Cast to text so the value is a `YYYY-MM-DD` string whatever the
        // driver does with a bare date — it goes straight into a message.
        lastEndedOn: sql<
          string | null
        >`(max(${m.endsOn}) filter (where ${m.endsOn} < ${on}::date))::text`,
        nextStartsOn: sql<
          string | null
        >`(min(${m.startsOn}) filter (where ${m.startsOn} > ${on}::date))::text`,
        // ::int because count() is a bigint, which the driver returns as a
        // string — `=== 0` would then never be true.
        total: sql<number>`count(*)::int`,
      })
      .from(m)
      .where(and(eq(m.memberId, memberId), isNull(m.deletedAt)));

    return row;
  }

  /**
   * The joins every read shares.
   *
   * The member's person and member rows are inner joins — a check-in cannot
   * exist without a member — but both name joins are left joins: a visit that
   * outlives whoever recorded it must still render, with a null name rather
   * than vanishing from the day's attendance. `overrider` is null on every
   * ordinary check-in by definition.
   */
  private baseQuery() {
    return this.db
      .select(checkInColumns)
      .from(schema.checkIns)
      .innerJoin(schema.person, eq(schema.person.id, schema.checkIns.memberId))
      .innerJoin(
        schema.member,
        eq(schema.member.personId, schema.checkIns.memberId),
      )
      .innerJoin(
        schema.branches,
        eq(schema.branches.id, schema.checkIns.branchId),
      )
      .leftJoin(recorder, eq(recorder.id, schema.checkIns.recordedByPersonId))
      .leftJoin(overrider, eq(overrider.id, schema.checkIns.overrideByStaffId));
  }
}

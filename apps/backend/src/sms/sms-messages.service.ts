import { Inject, Injectable, Logger } from '@nestjs/common';
import { and, desc, eq, ilike, isNull, or, sql, type SQL } from 'drizzle-orm';

import { gymToday, GYM_TODAY_SQL } from '../common/gym-day';
import { countOf, paginated, toOffset } from '../common/paginate';
import { isUniqueViolation } from '../common/pg-errors';
import type { Database } from '../database/database.client';
import { DRIZZLE } from '../database/database.constants';
import * as schema from '../database/schema';
import { NotificationsService } from '../notifications/notifications.service';
import type {
  BroadcastDto,
  SendSmsDto,
  SmsQueryDto,
  UpdateSmsSettingsDto,
} from './dto/sms.dto';

/** The singleton settings row. See the check constraint on the table. */
const SETTINGS_ID = 'default';

/**
 * How many messages to have in flight at once during a bulk send.
 *
 * Not unbounded: `Promise.all` over two thousand members would open two
 * thousand sockets to the provider at once, and the likeliest outcome is being
 * rate-limited into failing most of them. Not one-at-a-time either, which for
 * the same two thousand at ~300ms each is ten minutes.
 */
const BULK_CONCURRENCY = 5;

@Injectable()
export class SmsMessagesService {
  private readonly logger = new Logger(SmsMessagesService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: Database,
    private readonly notifications: NotificationsService,
  ) {}

  // ===== Reading =====

  /** The log, newest first. Never filtered by outcome — a failure is the point. */
  async findAll(query: SmsQueryDto) {
    const { page, limit, offset } = toOffset(query.page, query.limit);

    const conditions: SQL[] = [];
    if (query.kind) conditions.push(eq(schema.smsMessages.kind, query.kind));
    if (query.status)
      conditions.push(eq(schema.smsMessages.status, query.status));
    if (query.memberId)
      conditions.push(eq(schema.smsMessages.memberId, query.memberId));
    if (query.from)
      conditions.push(sql`${schema.smsMessages.sentOn} >= ${query.from}`);
    if (query.to)
      conditions.push(sql`${schema.smsMessages.sentOn} <= ${query.to}`);
    if (query.search) {
      const term = `%${query.search}%`;
      const match = or(
        ilike(schema.smsMessages.phone, term),
        ilike(schema.smsMessages.body, term),
      );
      if (match) conditions.push(match);
    }
    const where = conditions.length ? and(...conditions) : undefined;

    const sender = schema.person;
    const [data, countRows] = await Promise.all([
      this.db
        .select({
          id: schema.smsMessages.id,
          phone: schema.smsMessages.phone,
          memberId: schema.smsMessages.memberId,
          memberName: sql<
            string | null
          >`${sender.firstName} || ' ' || ${sender.lastName}`,
          body: schema.smsMessages.body,
          kind: schema.smsMessages.kind,
          status: schema.smsMessages.status,
          error: schema.smsMessages.error,
          sentOn: schema.smsMessages.sentOn,
          createdAt: schema.smsMessages.createdAt,
        })
        .from(schema.smsMessages)
        // Left, not inner: a direct send to a number belonging to no member is
        // a real case, and an inner join would drop exactly those rows.
        .leftJoin(sender, eq(sender.id, schema.smsMessages.memberId))
        .where(where)
        .limit(limit)
        .offset(offset)
        .orderBy(
          desc(schema.smsMessages.createdAt),
          desc(schema.smsMessages.id),
        ),
      this.db
        .select({ count: sql<number>`count(*)` })
        .from(schema.smsMessages)
        .where(where),
    ]);

    return paginated(data, countOf(countRows), page, limit);
  }

  /**
   * The reminder settings, creating the row the first time anyone asks.
   *
   * `onConflictDoNothing` rather than a check-then-insert: two requests landing
   * together would both see no row, and the primary key is what actually
   * settles it.
   */
  async getSettings() {
    await this.db
      .insert(schema.smsSettings)
      .values({ id: SETTINGS_ID })
      .onConflictDoNothing();

    const [row] = await this.db
      .select()
      .from(schema.smsSettings)
      .where(eq(schema.smsSettings.id, SETTINGS_ID));

    return row;
  }

  async updateSettings(dto: UpdateSmsSettingsDto, actorStaffId: string) {
    await this.getSettings();

    const [row] = await this.db
      .update(schema.smsSettings)
      .set({ ...dto, updatedByStaffId: actorStaffId })
      .where(eq(schema.smsSettings.id, SETTINGS_ID))
      .returning();

    return row;
  }

  // ===== Sending =====

  /**
   * One message to one number.
   *
   * The member is looked up by phone so the log can name them, but a number
   * belonging to nobody is not an error — texting a prospective member or a
   * supplier is a legitimate thing for a gym to do from this screen.
   */
  async send(dto: SendSmsDto, actorStaffId: string) {
    const [owner] = await this.db
      .select({ personId: schema.member.personId })
      .from(schema.member)
      .innerJoin(
        schema.person,
        and(
          eq(schema.person.id, schema.member.personId),
          isNull(schema.person.deletedAt),
        ),
      )
      .where(eq(schema.person.phone, dto.phone));

    return this.deliver({
      phone: dto.phone,
      memberId: owner?.personId ?? null,
      body: dto.message,
      kind: 'direct',
      sentByStaffId: actorStaffId,
    });
  }

  /**
   * The same message to every member, or every member on one plan.
   *
   * Returns as soon as the recipients are known and the sending is under way —
   * it does **not** wait for the last message. A thousand members at a few
   * hundred milliseconds each is minutes, and a receptionist holding a request
   * open that long will refresh the page and send it all again. The log is
   * where the outcome is read.
   */
  async broadcast(
    dto: BroadcastDto,
    actorStaffId: string,
    scope: string | null,
  ) {
    const recipients = await this.recipients(dto, scope);

    // Deliberately not awaited: see above. Errors cannot escape `deliver`,
    // which is what makes leaving this floating safe rather than a lost
    // rejection.
    void this.deliverAll(recipients, dto.message, actorStaffId);

    return { recipients: recipients.length };
  }

  /** Who a broadcast would reach, without sending anything. */
  async recipients(dto: BroadcastDto, scope: string | null) {
    const conditions: SQL[] = [isNull(schema.person.deletedAt)];
    if (scope) conditions.push(eq(schema.member.branchId, scope));

    if (dto.audience === 'plan') {
      // Everyone currently on that plan — a membership of theirs covers today.
      conditions.push(sql`exists (
        select 1 from ${schema.memberships} m
        where m.member_id = ${schema.member.personId}
          and m.deleted_at is null
          and m.plan_id = ${dto.planId}
          and ${GYM_TODAY_SQL} between m.starts_on and m.ends_on)`);
    }

    return this.db
      .select({
        memberId: schema.member.personId,
        phone: schema.person.phone,
        firstName: schema.person.firstName,
      })
      .from(schema.member)
      .innerJoin(schema.person, eq(schema.person.id, schema.member.personId))
      .where(and(...conditions));
  }

  /**
   * The daily expiry nudge. Called by the scheduler, and safe to call again.
   *
   * "From that day, every day, until it lapses" — so this is not "membership
   * ends in exactly N days", it is "ends within N days and has not ended yet".
   * A member seven days out is texted today, six days out tomorrow, and so on
   * to the last day; once expired they fall out of the query rather than
   * needing to be stopped.
   */
  async sendDueReminders() {
    const settings = await this.getSettings();

    if (!settings?.reminderEnabled) {
      return { sent: 0, skipped: 0, reason: 'disabled' as const };
    }

    const today = gymToday();
    const due = await this.db
      .select({
        memberId: schema.member.personId,
        phone: schema.person.phone,
        firstName: schema.person.firstName,
        // The furthest end date they hold, which is the one that decides when
        // they actually lapse.
        expiresOn: sql<string>`max(${schema.memberships.endsOn})::text`,
      })
      .from(schema.member)
      .innerJoin(
        schema.person,
        and(
          eq(schema.person.id, schema.member.personId),
          isNull(schema.person.deletedAt),
        ),
      )
      .innerJoin(
        schema.memberships,
        and(
          eq(schema.memberships.memberId, schema.member.personId),
          isNull(schema.memberships.deletedAt),
        ),
      )
      .groupBy(
        schema.member.personId,
        schema.person.phone,
        schema.person.firstName,
      )
      // Still running, and inside the window. Both halves matter: without the
      // lower bound this texts people whose membership ended months ago.
      .having(
        and(
          sql`max(${schema.memberships.endsOn}) >= ${GYM_TODAY_SQL}`,
          // `::int` is not optional. The driver sends the day count as an
          // untyped parameter, and Postgres has no `date + text` operator — so
          // without the cast the whole reminder run 500s, every day, silently
          // until somebody notices nobody was reminded.
          sql`max(${schema.memberships.endsOn}) <= ${GYM_TODAY_SQL} + ${settings.reminderDaysBefore}::int`,
        ),
      );

    let sent = 0;
    let skipped = 0;

    for (const member of due) {
      const daysLeft = daysBetween(today, member.expiresOn);
      const body = fillTemplate(settings.reminderTemplate, {
        name: member.firstName,
        days: String(daysLeft),
        date: member.expiresOn,
      });

      const result = await this.deliver({
        phone: member.phone,
        memberId: member.memberId,
        body,
        kind: 'reminder',
        sentByStaffId: null,
      });

      if (result.alreadySentToday) skipped += 1;
      else sent += 1;
    }

    this.logger.log(
      `Reminders: ${sent} sent, ${skipped} already done today, ${due.length} due`,
    );

    return { sent, skipped, reason: null };
  }

  // ===== The one place a message is actually sent =====

  /**
   * Send it, then write down what happened — whatever happened.
   *
   * The log row is written for held and failed messages too. A log that only
   * records successes cannot answer "did we tell them?", which is the only
   * question anyone will ask it.
   */
  private async deliver(message: {
    phone: string;
    memberId: string | null;
    body: string;
    kind: 'direct' | 'bulk' | 'reminder';
    sentByStaffId: string | null;
  }) {
    const result = await this.notifications.sendSmsResult(
      message.phone,
      message.body,
    );

    // Three outcomes, not two. `held` means the test allowlist stopped it —
    // nothing attempted, nothing charged — and a gym reading its log has to
    // tell that from a provider rejection.
    const status = result.delivered ? 'sent' : result.held ? 'held' : 'failed';

    try {
      await this.db.insert(schema.smsMessages).values({
        phone: message.phone,
        memberId: message.memberId,
        body: message.body,
        kind: message.kind,
        status,
        error: result.error ?? null,
        sentByStaffId: message.sentByStaffId,
        sentOn: gymToday(),
      });
    } catch (error) {
      // The once-a-day index rejected it: a reminder for this member is
      // already on today's log. That is the index doing its job, not a
      // failure — see `sms_reminder_once_per_day`.
      if (isUniqueViolation(error)) {
        return { ...result, alreadySentToday: true };
      }
      throw error;
    }

    return { ...result, alreadySentToday: false };
  }

  /** Bulk, a few at a time. See BULK_CONCURRENCY. */
  private async deliverAll(
    recipients: { memberId: string; phone: string; firstName: string }[],
    template: string,
    actorStaffId: string,
  ) {
    for (let i = 0; i < recipients.length; i += BULK_CONCURRENCY) {
      const batch = recipients.slice(i, i + BULK_CONCURRENCY);
      await Promise.all(
        batch.map((member) =>
          this.deliver({
            phone: member.phone,
            memberId: member.memberId,
            body: fillTemplate(template, { name: member.firstName }),
            kind: 'bulk',
            sentByStaffId: actorStaffId,
          }),
        ),
      );
    }
  }
}

/**
 * `{{name}}` and friends, substituted.
 *
 * Unknown placeholders are left exactly as written rather than blanked: a
 * message reading "Hi {{naem}}" is an obvious typo somebody will fix, where
 * "Hi ," looks like a system fault and gets reported as one.
 */
export function fillTemplate(
  template: string,
  values: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (whole, key: string) =>
    key in values ? values[key] : whole,
  );
}

/** Whole days from one gym date to another, both `YYYY-MM-DD`. */
export function daysBetween(from: string, to: string): number {
  const MS_PER_DAY = 86_400_000;
  return Math.round((Date.parse(to) - Date.parse(from)) / MS_PER_DAY);
}

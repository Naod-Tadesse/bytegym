import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  date,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

import { member } from './member';
import { staff } from './staff';

/**
 * Why the message went out. Not cosmetic: `reminder` is the one the scheduler
 * writes, and the partial unique index below keys off it to guarantee a member
 * is reminded at most once a day however many times the job runs.
 */
export const smsKind = pgEnum('sms_kind', [
  /** One number, typed by a member of staff. */
  'direct',
  /** Part of a send to every member, or every member on a plan. */
  'bulk',
  /** The automatic membership-expiry nudge. */
  'reminder',
]);

/**
 * What happened to it.
 *
 * `held` is its own answer rather than a kind of failure: it means the test
 * allowlist stopped it, so nothing was attempted and nothing was charged. A gym
 * reading its log needs to tell "the provider rejected this" from "we were not
 * sending for real yet", and `failed` would blur the two.
 */
export const smsStatus = pgEnum('sms_status', ['sent', 'failed', 'held']);

/**
 * Every message this system has tried to send.
 *
 * Written whatever the outcome, including held and failed ones — the log is
 * the answer to "did we tell them?", and a row that only appears on success
 * cannot answer it. Nothing here is ever deleted or updated: a message either
 * went or it did not, and that fact does not change afterwards. Hence no
 * `deleted_at` and no `updated_at`.
 *
 * The body is stored in full, not a template id. Templates get edited, and a
 * gym asked "what exactly did you send my mother" needs the text that was
 * actually sent, not what the template says today.
 */
export const smsMessages = pgTable(
  'sms_messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /**
     * The number as stored — local Ethiopian form, `0912345678`. The provider's
     * `251…` form is produced at the boundary and deliberately not kept: this
     * column has to join back to `person.phone`.
     */
    phone: varchar('phone', { length: 30 }).notNull(),
    /**
     * Who it was about, when it was about anybody. Null for a direct send to a
     * number that belongs to no member — a supplier, a prospective member, a
     * landlord. That is a real case, which is why this is nullable and why
     * `phone` is stored rather than being reachable only through the join.
     */
    memberId: uuid('member_id').references(() => member.personId),
    body: text('body').notNull(),
    kind: smsKind('kind').notNull(),
    status: smsStatus('status').notNull(),
    /** The provider's complaint, when it made one. Never shown to a member. */
    error: text('error'),
    /**
     * Who sent it. **Null means the scheduler did** — there is no service
     * account to attribute it to, and inventing one would make an automatic
     * send indistinguishable from a person's.
     */
    sentByStaffId: uuid('sent_by_staff_id').references(() => staff.personId),
    /**
     * The gym day it went out, in Africa/Addis_Ababa — written by the
     * application, never derived from `created_at`.
     *
     * A stored date column for the same reason `check_ins.checked_in_on` is
     * one: `created_at::date` depends on the session timezone, so Postgres
     * refuses it in an index, and 01:00 in Addis is the previous day in UTC.
     * The unique index below depends on this being the gym's day.
     */
    sentOn: date('sent_on').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    /**
     * At most one reminder per member per gym day.
     *
     * The index, not a pre-check, is what makes this true. The scheduler
     * re-running after a restart, two instances of the API both firing their
     * cron, a manual trigger on top of the automatic one — all of them race,
     * and under READ COMMITTED a "have we already sent one?" query sees no row
     * in every one of them. This is what a member being texted four times in a
     * morning would otherwise look like.
     *
     * Scoped to `reminder`, because bulk and direct sends are deliberately
     * repeatable: a gym may well message everyone twice in a day.
     */
    uniqueIndex('sms_reminder_once_per_day')
      .on(table.memberId, table.sentOn)
      .where(sql`${table.kind} = 'reminder'`),
    index('sms_messages_member_idx').on(table.memberId, table.createdAt),
    index('sms_messages_sent_on_idx').on(table.sentOn),
  ],
);

/**
 * The expiry-reminder configuration. **One row, ever.**
 *
 * A singleton table rather than a key/value settings store: there are three
 * settings, they are read together on every scheduler tick, and each has a
 * different type. A key/value table would make all three text and move the
 * validation into the application, where the day someone writes `"seven"` into
 * `reminder_days_before` is the day the job stops running.
 *
 * The check constraint is what makes "one row" true rather than merely
 * intended — without it a second row is one bad INSERT away, and which of the
 * two the gym is running on becomes a coin toss.
 */
export const smsSettings = pgTable(
  'sms_settings',
  {
    id: varchar('id', { length: 16 }).primaryKey().default('default'),
    /**
     * Off until somebody turns it on. Reminders cost money per member per day
     * and reach real phones — that is not a thing to start doing because a
     * migration ran.
     */
    reminderEnabled: boolean('reminder_enabled').notNull().default(false),
    /**
     * How many days before expiry the nudging starts. From that day the member
     * is texted **every day** until their membership lapses, so this number
     * multiplies directly into the bill — seven days is seven messages.
     */
    reminderDaysBefore: integer('reminder_days_before').notNull().default(7),
    /**
     * The hour of the gym's day the reminders go out, 0–23.
     *
     * A setting rather than a constant because it is a decision about the
     * gym's members, not about the software: a text at seven in the morning
     * reads differently from one at six in the evening, and only the gym knows
     * which its members prefer.
     */
    reminderHour: integer('reminder_hour').notNull().default(9),
    /**
     * The text, with `{{name}}`, `{{days}}` and `{{date}}` substituted at send
     * time. Stored per-gym rather than hardcoded because the wording is the
     * gym's voice, and in practice its language.
     */
    reminderTemplate: text('reminder_template')
      .notNull()
      .default(
        'Hi {{name}}, your gym membership ends on {{date}} ({{days}} days left). Renew at the front desk to keep training.',
      ),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    updatedByStaffId: uuid('updated_by_staff_id').references(
      () => staff.personId,
    ),
  },
  (table) => [
    check('sms_settings_singleton', sql`${table.id} = 'default'`),
    // A day is the smallest useful lead time and a year the largest sane one;
    // zero would mean "remind them the day it ends", which is a decision to
    // make deliberately rather than by leaving a field empty.
    check(
      'sms_settings_days_before_sane',
      sql`${table.reminderDaysBefore} between 1 and 365`,
    ),
    check(
      'sms_settings_hour_sane',
      sql`${table.reminderHour} between 0 and 23`,
    ),
  ],
);

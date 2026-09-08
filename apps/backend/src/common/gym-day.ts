import { sql } from 'drizzle-orm';

/**
 * Date-only arithmetic for the gym's calendar. Everything here is `YYYY-MM-DD`
 * strings, matching the `date` columns — Drizzle's node-postgres driver installs
 * a no-op parser for OID 1082, so a `date` never becomes a JS `Date`.
 */

/**
 * Where the gym is. One constant rather than an env var: it is one gym chain.
 *
 * Exported because SQL needs it too: a `timestamptz` filtered by a gym day has
 * to be shifted into this zone before it is truncated (`(received_at at time
 * zone GYM_TIME_ZONE)::date`), or the session's timezone — UTC on the server —
 * decides which day a 01:00 payment belongs to.
 */
export const GYM_TIME_ZONE = 'Africa/Addis_Ababa';

/**
 * `YYYY-MM-DD` and nothing else. DTOs pair it with `@IsDateString({ strict:
 * true })`: the pattern rejects the shapes `IsDateString` waves through — a
 * full `2027-03-01T00:00:00Z` timestamp, and the compact `20270301` — while
 * `strict` rejects the impossible calendar dates the pattern cannot see, like
 * `2027-02-30`. Neither alone is enough, and either gap reaches Postgres as a
 * 500 instead of a 400.
 */
export const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Today, as the gym reckons it.
 *
 * Deliberately NOT `new Date().toISOString().slice(0, 10)`. That is UTC, and
 * Addis is UTC+3: between midnight and 03:00 local, UTC is still on yesterday.
 * A membership sold at 01:00 would start the day before and expire a day early.
 *
 * `en-CA` is the locale whose short date format is already ISO order, so this
 * yields `YYYY-MM-DD` with no reassembly.
 */
export const gymToday = (): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: GYM_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());

/**
 * The same day as `gymToday()`, but computed inside Postgres.
 *
 * **Never write bare `current_date`** in a query that touches `starts_on` or
 * `ends_on`. `current_date` is read in the session's timezone, which is UTC on
 * the server, so between midnight and 03:00 in Addis it is still yesterday: a
 * membership starting today reads as not yet begun for the first three hours
 * of every day, and one that ended yesterday still reads `active`.
 * That is the gym's early-morning shift, the busiest hours the desk works.
 *
 * Postgres rather than a bound `gymToday()` so the date is fixed by the same
 * statement that uses it — a value threaded in from JS can be a request old by
 * the time it lands, which is a whole day wrong at exactly midnight.
 *
 * `::text` on the parameter because `at time zone` needs to know the operand is
 * text; without it the driver sends an untyped parameter and Postgres cannot
 * resolve the operator.
 */
export const GYM_TODAY_SQL = sql`(now() at time zone ${GYM_TIME_ZONE}::text)::date`;

/**
 * The hour of the day, 0–23, as the gym reckons it.
 *
 * The same trap as `gymToday`: the server runs in UTC and Addis is UTC+3, so
 * `new Date().getHours()` is three hours behind the gym. A job that fires "at
 * nine" on the server's clock texts members at six in the morning.
 */
export const gymHour = (): number =>
  Number(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: GYM_TIME_ZONE,
      hour: '2-digit',
      hour12: false,
    }).format(new Date()),
  );

/**
 * `iso` shifted by whole days, still date-only.
 *
 * Built on `Date.UTC` so it is pure calendar arithmetic: a local-time `Date`
 * would cross a DST boundary in some zones and land on the wrong day. Ethiopia
 * has no DST, but this function must not depend on that.
 */
export function addDaysISO(iso: string, days: number): string {
  const [year, month, day] = iso.split('-').map(Number);
  const at = new Date(Date.UTC(year, month - 1, day));

  // Defence in depth — the DTO is what returns a 400. Without this, a caller
  // that skipped validation gets silence rather than a failure: a timestamp
  // parses to NaN and an impossible date like 2027-02-30 rolls over to March,
  // so `ends_on` would be computed from a day `starts_on` never was.
  if (Number.isNaN(at.getTime()) || at.toISOString().slice(0, 10) !== iso) {
    throw new RangeError(`Not a calendar date in YYYY-MM-DD form: ${iso}`);
  }

  at.setUTCDate(at.getUTCDate() + days);
  return at.toISOString().slice(0, 10);
}

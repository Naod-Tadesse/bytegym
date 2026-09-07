/**
 * The timezone the gym trades in. Mirrors the backend's `src/common/gym-day.ts`
 * — attendance is filed against the gym's calendar day, not the server's and
 * not the browser's.
 */
export const GYM_TIME_ZONE = 'Africa/Addis_Ababa';

/**
 * Today, as the gym reckons it (`yyyy-MM-dd`).
 *
 * Deliberately **not** `new Date().toISOString().slice(0, 10)`, which is UTC:
 * 01:00 in Addis is still the previous day there, so an early-morning visit
 * would be asked for under yesterday's date. `en-CA` is the locale that formats
 * as `YYYY-MM-DD`, so nothing needs reassembling.
 *
 * The browser's own timezone is not trusted either — a laptop left on another
 * zone would ask the API for the wrong day, and the desk would see an empty
 * list with no hint why.
 */
export const gymToday = (): string =>
  new Intl.DateTimeFormat('en-CA', { timeZone: GYM_TIME_ZONE }).format(
    new Date(),
  );

/**
 * The clock time of an ISO timestamp, in the gym's timezone.
 *
 * `date-fns`'s `format` would render it in the browser's zone, which is the
 * same mistake as above one layer up: the row would say a member arrived at
 * 06:00 because the receptionist's machine is set to UTC.
 */
export const formatGymTime = (iso: string): string =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone: GYM_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(iso));

/**
 * Whole days from the gym's today until `date` (inclusive of that last day).
 *
 * Counted on calendar days in the gym's timezone, not by subtracting
 * timestamps: "expires tomorrow" must not become "in 0 days" merely because
 * the browser is a few hours ahead. Negative once the date has passed.
 */
export const gymDaysUntil = (date: string): number => {
  const MS_PER_DAY = 86_400_000;
  const today = Date.parse(`${gymToday()}T00:00:00Z`);
  const target = Date.parse(`${date}T00:00:00Z`);
  return Math.round((target - today) / MS_PER_DAY);
};

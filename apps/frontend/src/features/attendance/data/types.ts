import type {
  CheckIn,
  CheckInTableState,
} from '@/features/check-ins/data/types';

/**
 * Attendance and check-ins read the same endpoint and so the same row.
 *
 * Re-exported rather than re-declared: two hand-written mirrors of one DTO drift
 * the first time a column is added to it, and the compiler cannot tell you which
 * of them is now wrong. The desk and the register are different screens over the
 * same record, not different records.
 */
export type AttendanceRecord = CheckIn;

/**
 * `from`/`to` are gym calendar days, `yyyy-MM-dd`, both **inclusive** — the same
 * date twice is a single day.
 *
 * Attendance always carries both. The desk asks "who is here now" and can lean
 * on the server's default; this screen's whole subject is the range, so it is
 * never implicit — the heading counts over it and the query key has to change
 * when it does.
 *
 * `search` is inherited from `TableState` and the endpoint ignores it (a
 * check-in carries no text of its own), so the table hides its search box and
 * filters by member instead.
 */
export type AttendanceTableState = CheckInTableState;

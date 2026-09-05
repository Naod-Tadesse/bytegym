import { sql } from 'drizzle-orm';

import type { Database, Transaction } from './database.client';

/** `ST` + a zero-padded sequence number, e.g. `ST00007`. */
const PREFIX = 'ST';
const WIDTH = 5;

/**
 * Draws the next staff code. Pass the transaction handle when called inside
 * one, so the read joins the same transaction as the insert.
 *
 * `nextval` is atomic and never blocks, so concurrent hires get distinct
 * numbers without a uniqueness pre-check.
 */
export async function nextStaffCode(
  db: Database | Transaction,
): Promise<string> {
  const result = await db.execute<{ value: string }>(
    sql`select nextval('staff_code_seq') as value`,
  );
  const [row] = result.rows;

  return `${PREFIX}${String(row.value).padStart(WIDTH, '0')}`;
}

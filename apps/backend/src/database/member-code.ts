import { sql } from 'drizzle-orm';

import type { Database, Transaction } from './database.client';

/** `MBR` + a zero-padded sequence number, e.g. `MBR00007`. */
const PREFIX = 'MBR';
const WIDTH = 5;

/**
 * Draws the next member code. Pass the transaction handle when called inside
 * one, so the read joins the same transaction as the insert.
 *
 * `nextval` is atomic and never blocks, so concurrent registrations get
 * distinct numbers without a uniqueness pre-check.
 */
export async function nextMemberCode(
  db: Database | Transaction,
): Promise<string> {
  const result = await db.execute<{ value: string }>(
    sql`select nextval('member_code_seq') as value`,
  );
  const [row] = result.rows;

  return `${PREFIX}${String(row.value).padStart(WIDTH, '0')}`;
}

import { Pool, type QueryResultRow } from 'pg';
import { DATABASE_URL } from './env';
import { record } from './manifest';

let pool: Pool | undefined;

export function db(): Pool {
  pool ??= new Pool({ connectionString: DATABASE_URL, max: 4 });
  return pool;
}

export async function closeDb(): Promise<void> {
  await pool?.end();
  pool = undefined;
}

export async function sql<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const res = await db().query<T>(text, params);
  return res.rows;
}

/**
 * Insert a membership directly.
 *
 * There is no other way to produce one: POST /api/memberships has no
 * `startsOn` field — it always uses the gym's today — so an expired or future
 * membership is unreachable through the API. `price` and `registrationFee` are
 * snapshots taken at sale, which is why they are passed rather than joined.
 */
export async function insertMembership(opts: {
  memberId: string;
  planId: string;
  startsOn: string;
  endsOn: string;
  price?: string;
  registrationFee?: string;
  isComplimentary?: boolean;
}): Promise<{ id: string }> {
  const rows = await sql<{ id: string }>(
    `insert into memberships
       (member_id, plan_id, starts_on, ends_on, price, registration_fee, is_complimentary)
     values ($1, $2, $3, $4, $5, $6, $7)
     returning id`,
    [
      opts.memberId,
      opts.planId,
      opts.startsOn,
      opts.endsOn,
      opts.price ?? '1000.00',
      opts.registrationFee ?? '0.00',
      opts.isComplimentary ?? false,
    ],
  );
  const id = rows[0].id;
  record('memberships', id);
  return { id };
}

/** Rows a test needs to inspect but no endpoint exposes. */
export const peek = {
  sessions: (personId: string) =>
    sql<{ id: string; revoked_at: string | null; audience: string }>(
      `select id, revoked_at, audience from sessions where person_id = $1`,
      [personId],
    ),
  account: (personId: string) =>
    sql<{ id: string; status: string; password_hash: string | null }>(
      `select id, status, password_hash from accounts where person_id = $1`,
      [personId],
    ),
  membership: (id: string) =>
    sql<{
      id: string;
      starts_on: string;
      ends_on: string;
      price: string;
      registration_fee: string;
      deleted_at: string | null;
    }>(
      `select id, starts_on, ends_on, price, registration_fee, deleted_at
         from memberships where id = $1`,
      [id],
    ),
  checkIn: (memberId: string, day: string) =>
    sql<{
      id: string;
      membership_id: string | null;
      override_by_staff_id: string | null;
      branch_id: string;
    }>(
      `select id, membership_id, override_by_staff_id, branch_id
         from check_ins where member_id = $1 and checked_in_on = $2`,
      [memberId, day],
    ),
  person: (id: string) =>
    sql<{ id: string; deleted_at: string | null; phone: string }>(
      `select id, deleted_at, phone from person where id = $1`,
      [id],
    ),
  /**
   * Terminating soft-deletes the person, and every staff read filters
   * isNull(person.deleted_at) — so a terminated employee is unreachable through
   * the API and the only way to assert on their row is here.
   */
  staff: (personId: string) =>
    sql<{
      person_id: string;
      staff_code: string;
      employment_status: string;
      terminated_on: string | null;
      data_scope: string;
      primary_branch_id: string;
    }>(
      `select person_id, staff_code, employment_status, terminated_on,
              data_scope, primary_branch_id
         from staff where person_id = $1`,
      [personId],
    ),
};

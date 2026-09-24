import { existsSync, unlinkSync } from 'node:fs';
import { KEEP_DATA, manifestPath } from './support/env';
import { closeDb, sql } from './support/db';
import { readManifest, type Tracked } from './support/manifest';

/**
 * The suite runs against the developer's own database, so every row it created
 * has to go back out again — and it cannot go out through the API. Branches and
 * membership plans have no delete route at all (a branch "delete" only flips
 * isActive), and memberships, payments, check-ins and SMS rows have none
 * either. Both branch and plan names are unique on lower(name) with no
 * deletedAt, so an API-only teardown would burn a name on every run and fill
 * the two pickers the front desk uses.
 *
 * Deletion is ordered by hand rather than generated, because the dependencies
 * are not a straight line: accounts, sessions and account_roles all hang off a
 * person, and account_roles and role_permissions both hang off a role.
 */
export default async function globalTeardown(): Promise<void> {
  if (KEEP_DATA) {
    console.log(`\n  E2E_KEEP_DATA=1 — leaving this run's rows in place.\n`);
    await closeDb();
    return;
  }

  const byTable = new Map<Tracked, string[]>();
  for (const e of readManifest()) {
    byTable.set(e.table, [...(byTable.get(e.table) ?? []), e.id]);
  }
  const ids = (t: Tracked) => [...new Set(byTable.get(t) ?? [])];

  const people = [...new Set([...ids('person'), ...ids('member'), ...ids('staff')])];
  const roles = ids('roles');

  let removed = 0;
  const failures: string[] = [];

  const step = async (label: string, text: string, params: unknown[]) => {
    // A step whose only parameter is an empty id list has nothing to do.
    if (params.length && (params[0] as unknown[]).length === 0) return;
    try {
      const rows = await sql(`${text} returning 1 as one`, params);
      removed += rows.length;
    } catch (err) {
      failures.push(`${label}: ${(err as Error).message}`);
    }
  };

  // SMS rows cannot be tracked by id: POST /sms/send answers with a delivery
  // result, not the logged message. Every message the suite sends therefore
  // starts with "E2E" so it can be swept by body, and broadcasts are caught by
  // the member sweep below as well.
  await step('sms_messages(body)', `delete from sms_messages where body like 'E2E%'`, []);

  // Credentials and grants first — they block the person delete, and a login
  // during the run mints session rows no factory ever recorded.
  await step(
    'account_roles',
    `delete from account_roles where account_id in
       (select id from accounts where person_id = any($1::uuid[]))`,
    [people],
  );
  await step('sessions', `delete from sessions where person_id = any($1::uuid[])`, [people]);
  await step('accounts', `delete from accounts where person_id = any($1::uuid[])`, [people]);

  // Activity, innermost first.
  await step('sms_messages', `delete from sms_messages where member_id = any($1::uuid[])`, [people]);
  await step('check_ins', `delete from check_ins where member_id = any($1::uuid[])`, [people]);
  await step('check_ins(by)', `delete from check_ins where recorded_by_person_id = any($1::uuid[])`, [people]);
  await step('payments', `delete from payments where member_id = any($1::uuid[])`, [people]);
  await step('payments(id)', `delete from payments where id = any($1::uuid[])`, [ids('payments')]);
  await step('memberships', `delete from memberships where member_id = any($1::uuid[])`, [people]);
  await step('memberships(id)', `delete from memberships where id = any($1::uuid[])`, [ids('memberships')]);

  // Profiles, then the person they hang off.
  await step('member', `delete from member where person_id = any($1::uuid[])`, [people]);
  await step('staff', `delete from staff where person_id = any($1::uuid[])`, [people]);
  await step('person', `delete from person where id = any($1::uuid[])`, [people]);

  // Roles: detach from accounts and permissions before removing the role.
  await step('account_roles(role)', `delete from account_roles where role_id = any($1::uuid[])`, [roles]);
  await step('role_permissions', `delete from role_permissions where role_id = any($1::uuid[])`, [roles]);
  await step('roles', `delete from roles where id = any($1::uuid[])`, [roles]);

  await step('membership_plans', `delete from membership_plans where id = any($1::uuid[])`, [ids('membership_plans')]);
  await step('branches', `delete from branches where id = any($1::uuid[])`, [ids('branches')]);

  // Orphans from a run that died before teardown — a crashed dev server, a
  // killed process. Scoped strictly to the 'E2E' first name and the 'E2E-'
  // name prefix the factories always use, so it can never touch a real record.
  // Without this the residue is permanent: branches and plans have no delete
  // endpoint and their names are unique.
  await sweepOrphans(step);

  await closeDb();

  const file = manifestPath();
  if (existsSync(file)) unlinkSync(file);

  if (failures.length) {
    console.warn(
      `\n  teardown removed ${removed} rows but hit ${failures.length} problem(s):\n` +
        failures.map((f) => `    - ${f}`).join('\n') +
        `\n  Leftovers are identifiable by the 'E2E-' name prefix. To find them:\n` +
        `    select name from branches where name like 'E2E-%';\n`,
    );
  } else {
    console.log(`\n  teardown removed ${removed} rows.\n`);
  }
}

type Step = (label: string, text: string, params: unknown[]) => Promise<void>;

/**
 * Remove anything left by a run that never reached teardown.
 *
 * Every predicate is anchored to a marker only the factories produce:
 * person.first_name = 'E2E', or a name beginning 'E2E-'. Nothing a human
 * created can match.
 */
export async function sweepOrphans(step: Step): Promise<void> {
  const people = `select id from person where first_name = 'E2E'`;
  const roles = `select id from roles where name like 'E2E-%'`;

  await step('orphan sms', `delete from sms_messages where body like 'E2E%'`, []);
  await step('orphan sms(member)', `delete from sms_messages where member_id in (${people})`, []);
  await step('orphan check_ins', `delete from check_ins where member_id in (${people})`, []);
  await step(
    'orphan check_ins(by)',
    `delete from check_ins where recorded_by_person_id in (${people})`,
    [],
  );
  await step('orphan payments', `delete from payments where member_id in (${people})`, []);
  await step('orphan memberships', `delete from memberships where member_id in (${people})`, []);

  await step(
    'orphan account_roles',
    `delete from account_roles where account_id in
       (select id from accounts where person_id in (${people}))`,
    [],
  );
  await step('orphan sessions', `delete from sessions where person_id in (${people})`, []);
  await step('orphan accounts', `delete from accounts where person_id in (${people})`, []);
  await step('orphan member', `delete from member where person_id in (${people})`, []);
  await step('orphan staff', `delete from staff where person_id in (${people})`, []);
  await step('orphan person', `delete from person where first_name = 'E2E'`, []);

  await step('orphan account_roles(role)', `delete from account_roles where role_id in (${roles})`, []);
  await step('orphan role_permissions', `delete from role_permissions where role_id in (${roles})`, []);
  await step('orphan roles', `delete from roles where name like 'E2E-%'`, []);

  await step('orphan plans', `delete from membership_plans where name like 'E2E-%'`, []);
  await step('orphan branches', `delete from branches where name like 'E2E-%'`, []);
}

import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { manifestPath } from './env';

/**
 * The tables a run can create rows in, in the order teardown must delete them
 * so foreign keys never block. `person` is last of the identity group because
 * staff/member/accounts all reference it.
 */
export type Tracked =
  | 'sms_messages'
  | 'check_ins'
  | 'payments'
  | 'memberships'
  | 'member'
  | 'account_roles'
  | 'sessions'
  | 'accounts'
  | 'staff'
  | 'person'
  | 'role_permissions'
  | 'roles'
  | 'membership_plans'
  | 'branches';

export const DELETE_ORDER: Tracked[] = [
  'sms_messages',
  'check_ins',
  'payments',
  'memberships',
  'member',
  'account_roles',
  'sessions',
  'accounts',
  'staff',
  'person',
  'role_permissions',
  'roles',
  'membership_plans',
  'branches',
];

export interface Entry {
  table: Tracked;
  id: string;
}

/**
 * One JSON object per line, appended with O_APPEND. Workers are separate
 * processes, so a read-modify-write of a single JSON array would lose entries;
 * short line-appends do not interleave.
 */
export function record(table: Tracked, id: string): void {
  const file = manifestPath();
  mkdirSync(dirname(file), { recursive: true });
  appendFileSync(file, `${JSON.stringify({ table, id })}\n`, 'utf8');
}

export function readManifest(): Entry[] {
  const file = manifestPath();
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Entry);
}

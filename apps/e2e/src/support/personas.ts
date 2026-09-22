import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { E2E_ROOT, OWNER, RUN_ID } from './env';

export type PersonaKey =
  | 'owner'
  | 'manager'
  | 'reception'
  | 'noaccess'
  | 'disabled'
  | 'terminated';

/** Everything a spec needs to act as, or act upon, a persona. */
export interface Persona {
  key: PersonaKey;
  phone: string;
  password: string;
  personId: string;
  branchId: string;
  /** Can they complete POST /auth/login? */
  canSignIn: boolean;
}

export const PERSONA_PASSWORD = 'E2ePass@123';

/**
 * The permission sets the narrow personas hold.
 *
 * `reception` is deliberately missing checkin.override, payment.void,
 * member.update, member.delete, staff.*, role.* and report.view — those absences
 * are what the "control is not rendered" and "403" cases assert against.
 */
export const RECEPTION_PERMISSIONS = [
  'member.list',
  'member.read',
  'member.create',
  'plan.list',
  'membership.list',
  'membership.sell',
  'payment.list',
  'payment.record',
  'checkin.list',
  'checkin.record',
  'sms.list',
];

export const MANAGER_PERMISSIONS = [
  'member.list',
  'member.read',
  'member.create',
  'member.update',
  'member.delete',
  'plan.list',
  'membership.list',
  'membership.sell',
  'payment.list',
  'payment.record',
  'payment.void',
  'checkin.list',
  'checkin.record',
  'checkin.override',
  'branch.list',
  'staff.list',
  'staff.read',
  'report.view',
];

const personasFile = () =>
  resolve(E2E_ROOT, 'test-output', `personas-${RUN_ID()}.json`);

export interface PersonaBundle {
  personas: Record<PersonaKey, Persona>;
  /** A second branch, so branch-scoping has somewhere to be scoped away from. */
  otherBranchId: string;
  mainBranchId: string;
}

export function personasPath(): string {
  return personasFile();
}

export function loadPersonas(): PersonaBundle {
  const file = personasFile();
  if (!existsSync(file)) {
    throw new Error(
      `${file} is missing — the 'setup' project must run before api/ui.`,
    );
  }
  return JSON.parse(readFileSync(file, 'utf8')) as PersonaBundle;
}

export function credentialsFor(key: PersonaKey): {
  phone: string;
  password: string;
} {
  if (key === 'owner') return OWNER;
  const p = loadPersonas().personas[key];
  return { phone: p.phone, password: p.password };
}

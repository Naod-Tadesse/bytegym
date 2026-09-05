import type { NewJobTitle } from './schema';

/**
 * The job title catalogue — CODE, not data, exactly like permissions.data.ts.
 *
 * There is deliberately no API to create one. Job titles are a small closed set
 * that the application branches on, and the moment a user can type a new one,
 * `if (title === 'Trainer')` starts silently missing: "Senior Trainer" and
 * "Trainner" would both get none of the behaviour attached to trainers, with no
 * error anywhere. That is the same failure mode the permission catalogue avoids
 * by living in code.
 *
 * TWO RULES for anything built on top of this:
 *
 *  1. Branch on `code`, NEVER on `name`. `name` is a display label a gym may
 *     want to change — renaming Trainer to "Personal Trainer" must not break
 *     logic. `code` is the stable join point and never changes.
 *  2. Prefer a capability FLAG over a code comparison. `canHaveAccount` is the
 *     pattern: when trainers gain meal plans, add `canTrainMembers` rather than
 *     scattering `code === 'trainer'` around, so a gym that calls them Coaches
 *     still works. Permissions answer "may they do X"; flags here answer "what
 *     are they".
 *
 * To add one: append it here and re-run db-seed. The seed is idempotent
 * (onConflictDoNothing on `code`), so no migration is needed.
 */
export const SEED_JOB_TITLES: NewJobTitle[] = [
  { code: 'owner', name: 'Owner', canHaveAccount: true },
  { code: 'manager', name: 'Manager', canHaveAccount: true },
  { code: 'receptionist', name: 'Receptionist', canHaveAccount: true },
  { code: 'trainer', name: 'Trainer', canHaveAccount: false },
  { code: 'cleaner', name: 'Cleaner', canHaveAccount: false },
];

/** Stable identifiers the application may branch on. Never branch on a name. */
export const JOB_TITLE_CODES = {
  OWNER: 'owner',
  MANAGER: 'manager',
  RECEPTIONIST: 'receptionist',
  TRAINER: 'trainer',
  CLEANER: 'cleaner',
} as const;

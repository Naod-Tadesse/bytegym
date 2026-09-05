import { pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

import { person } from './person';

/**
 * Whether this credential may be used right now.
 *
 * An enum rather than a boolean because a third state is coming: `locked`,
 * set automatically after repeated failed sign-ins, which is a different fact
 * from an administrator switching the login off and wants a different message
 * and a different way back in.
 *
 * This is about the CREDENTIAL, not the person. Someone barred from the
 * premises is a different question, recorded on member / staff.
 */
export const accountStatus = pgEnum('account_status', ['active', 'disabled']);

/**
 * The EXISTENCE of a row here is the right to authenticate. No row means no
 * credential exists to check — so there is no nullable column anyone can forget
 * to test, and no branch a later refactor can quietly delete. A cleaner is a
 * full employee with no accounts row.
 *
 * Revoking access is DELETING the row, not soft-deleting it. A revoked
 * credential should stop existing; audit_logs records who removed it. Keeping
 * it would mean every read has to remember to filter it out, which is the exact
 * failure this table exists to prevent.
 *
 * No provider or identifier column: the endpoint already knows the method, and
 * login looks people up by person.phone.
 */
export const accounts = pgTable('accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  /** Unique — one account per human, not one per credential type. */
  personId: uuid('person_id')
    .notNull()
    .unique()
    .references(() => person.id, { onDelete: 'cascade' }),
  /**
   * Disabling keeps the credential — same password, still there — where
   * revoking deletes the row outright. Use disable for a temporary
   * lock-out you intend to lift; use revoke when access should stop existing.
   */
  status: accountStatus('status').notNull().default('active'),
  /** bcrypt. NULL means this account signs in by SMS code instead — a member. */
  passwordHash: text('password_hash'),
  lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;

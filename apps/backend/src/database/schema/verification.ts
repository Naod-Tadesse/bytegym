import {
  char,
  index,
  integer,
  pgEnum,
  pgTable,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const verificationPurpose = pgEnum('verification_purpose', [
  // a member signing in to the app
  'login_otp',
  // confirming a new number before it becomes a login handle
  'phone_change',
]);

/**
 * Short-lived one-time codes.
 *
 * NOTHING READS THIS YET — it lands with member SMS sign-in. It exists now
 * because an OTP has no long-lived secret to store on the account: the code IS
 * the credential, for ninety seconds.
 *
 * Three rules, all of which have been got wrong by somebody:
 *
 *  1. Store sha256 of the code, never the code. A six-digit code in plaintext
 *     is a database leak that hands over every account currently signing in.
 *  2. Single use. Stamp consumedAt on success and refuse an already-consumed
 *     row, or a code read over someone's shoulder stays valid until it expires.
 *  3. Cap attempts. Six digits is a million combinations, which is nothing to a
 *     script — without a counter the code is brute-forceable inside its own
 *     lifetime.
 *
 * Rows are disposable: sweep expired ones on a schedule. Nothing references
 * them and no history depends on them.
 */
export const verification = pgTable(
  'verification',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** The phone the code was sent to. */
    identifier: varchar('identifier', { length: 30 }).notNull(),
    purpose: verificationPurpose('purpose').notNull(),
    codeHash: char('code_hash', { length: 64 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    /** A consumed code is dead even before it expires. */
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    attempts: integer('attempts').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('verification_identifier_purpose_idx').on(
      table.identifier,
      table.purpose,
    ),
    index('verification_expires_idx').on(table.expiresAt),
  ],
);

export type Verification = typeof verification.$inferSelect;
export type NewVerification = typeof verification.$inferInsert;

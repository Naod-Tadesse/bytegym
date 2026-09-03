import { char, index, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';

import { users } from './users';

/**
 * One row per logged-in device, so logout and force-logout work and signing in
 * on a phone does not kill the desktop session.
 *
 * Stores the sha256 hash of the refresh token, never the token itself.
 */
export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    refreshTokenHash: char('refresh_token_hash', { length: 64 })
      .notNull()
      .unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('sessions_user_revoked_idx').on(table.userId, table.revokedAt),
  ],
);

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

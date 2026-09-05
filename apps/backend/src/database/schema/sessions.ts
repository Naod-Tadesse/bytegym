import { char, index, pgEnum, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';

import { person } from './person';

/**
 * Which surface a session was minted for, and therefore which secret signed it.
 *
 * `staff`  — the admin API, signed with JWT_SECRET
 * `member` — the mobile app, signed with JWT_APP_SECRET
 *
 * Signing the two with different secrets is what makes a member token fail
 * VERIFICATION on a staff route rather than merely failing authorisation: there
 * is no decorator to forget and no guard ordering to get wrong. That matters
 * most for routes carrying no @Permissions(), which are authenticated-only and
 * would otherwise admit any valid token.
 */
export const sessionAudience = pgEnum('session_audience', ['staff', 'member']);

/**
 * One row per logged-in device, so logout and force-logout work and signing in
 * on a phone does not kill the desktop session.
 *
 * Stores sha256 hashes, never the tokens themselves.
 */
export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    personId: uuid('person_id')
      .notNull()
      .references(() => person.id, { onDelete: 'cascade' }),
    audience: sessionAudience('audience').notNull().default('staff'),
    /**
     * Recorded, but deliberately NOT checked on every request — the JWT stays
     * stateless, so authorising a call costs no query. This exists so an
     * active-sessions view can show what was issued and when.
     *
     * NOT unique, unlike refreshTokenHash, and that asymmetry is deliberate.
     * Only the refresh token carries a `jti`; two access tokens signed in the
     * same second for the same person have identical claims and an identical
     * `iat` (second resolution), so they are byte-identical and hash the same.
     * A unique index here turns two rapid logins into a 500. Uniqueness would
     * only be worth having if sessions were looked up by access token, which
     * they deliberately are not.
     */
    accessTokenHash: char('access_token_hash', { length: 64 }),
    accessTokenExpiresAt: timestamp('access_token_expires_at', {
      withTimezone: true,
    }),
    refreshTokenHash: char('refresh_token_hash', { length: 64 })
      .notNull()
      .unique(),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', {
      withTimezone: true,
    }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index('sessions_person_revoked_idx').on(table.personId, table.revokedAt),
    // Revocation is targeted: a role change must kill staff sessions without
    // signing the same human out of the member app, where none of it applies.
    index('sessions_person_audience_revoked_idx').on(
      table.personId,
      table.audience,
      table.revokedAt,
    ),
  ],
);

export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;

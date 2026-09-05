import { boolean, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

/**
 * What someone does, as data rather than free text — so that "a cleaner has no
 * reason to sign in" is a fact the API can enforce instead of a convention the
 * UI hopes for.
 *
 * A lookup table rather than a pgEnum precisely because of `canHaveAccount`: an
 * enum cannot carry a column.
 *
 * The ROWS are seeded from job-titles.data.ts and there is no API to create
 * one — see that file for why. This table is the FK target and the carrier of
 * capability flags, not a user-editable list.
 *
 * Retired with isActive like branches, never soft-deleted, because every staff
 * row ever created points here and must stay readable — which also makes a
 * plain unique safe, with no partial index needed.
 */
export const jobTitles = pgTable('job_titles', {
  id: uuid('id').primaryKey().defaultRandom(),
  /**
   * The stable identifier application code branches on. Never changes, even if
   * the gym renames the label — which is the whole reason it is separate from
   * `name`.
   */
  code: varchar('code', { length: 40 }).notNull().unique(),
  /** Display label. Safe to change; nothing branches on it. */
  name: varchar('name', { length: 80 }).notNull().unique(),
  /**
   * Whether someone with this title may be given a login at all. Enforced in
   * the API, not just hidden in the UI — otherwise curl can still mint
   * credentials for a cleaner.
   */
  canHaveAccount: boolean('can_have_account').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type JobTitle = typeof jobTitles.$inferSelect;
export type NewJobTitle = typeof jobTitles.$inferInsert;

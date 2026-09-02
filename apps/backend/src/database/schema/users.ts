import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Placeholder table used to verify the database wiring end to end.
 * Replace it with the real bytegym domain tables.
 */
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

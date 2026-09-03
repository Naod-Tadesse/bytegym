import { pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';

/**
 * No soft delete here, so a plain unique on `name` is safe.
 *
 * NOTE: `group` is a reserved word in SQL. Drizzle quotes identifiers, so this
 * only bites in hand-written SQL and psql, where it needs to be "group".
 */
export const permissions = pgTable('permissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  /** The key checked in code, e.g. member.create */
  name: varchar('name', { length: 255 }).notNull().unique(),
  displayName: varchar('display_name', { length: 255 }).notNull(),
  description: varchar('description', { length: 500 }),
  /** How the permission is bucketed in the admin UI, e.g. Members, Billing */
  group: varchar('group', { length: 100 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type Permission = typeof permissions.$inferSelect;
export type NewPermission = typeof permissions.$inferInsert;

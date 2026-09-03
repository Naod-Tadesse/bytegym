import { sql } from 'drizzle-orm';
import {
  boolean,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

/**
 * Roles carry no fields of their own, only permissions. There is no member role
 * here — that is the profile row.
 */
export const roles = pgTable(
  'roles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** owner, manager, receptionist, trainer */
    name: varchar('name', { length: 255 }).notNull(),
    description: varchar('description', { length: 500 }),
    isActive: boolean('is_active').notNull().default(true),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    // Partial: this table soft deletes, so a deleted role must not hold its
    // name forever.
    uniqueIndex('roles_name_active_uniq')
      .on(table.name)
      .where(sql`${table.deletedAt} is null`),
  ],
);

export type Role = typeof roles.$inferSelect;
export type NewRole = typeof roles.$inferInsert;

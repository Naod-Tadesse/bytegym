import { sql } from 'drizzle-orm';
import {
  boolean,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const branches = pgTable(
  'branches',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /**
     * Unique on `lower(name)` via the index below, not `.unique()` here. The
     * service compares names case-insensitively, and a pre-check with no index
     * behind it is a TOCTOU race: two concurrent requests for "Bole" and "bole"
     * both see no duplicate and a case-sensitive constraint accepts both.
     */
    name: varchar('name', { length: 120 }).notNull(),
    addressLine: varchar('address_line', { length: 255 }),
    city: varchar('city', { length: 80 }),
    phone: varchar('phone', { length: 30 }),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex('branches_name_lower_uniq').on(sql`lower(${table.name})`),
  ],
);

export type Branch = typeof branches.$inferSelect;
export type NewBranch = typeof branches.$inferInsert;

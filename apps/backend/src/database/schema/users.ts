import { sql } from 'drizzle-orm';
import {
  date,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const userStatus = pgEnum('user_status', [
  'active',
  // barred from the premises entirely, not the same as being fired
  'suspended',
  'deactivated',
]);

export const genderType = pgEnum('gender_type', ['male', 'female']);

/**
 * One row per human, forever. There is NO user_type column — what a person is
 * comes from which profile rows exist (staff_profiles, member_profiles).
 */
export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    firstName: varchar('first_name', { length: 80 }).notNull(),
    lastName: varchar('last_name', { length: 80 }).notNull(),
    /** Login handle for staff, contact handle for members. One normalised format. */
    phone: varchar('phone', { length: 30 }).notNull(),
    /** bcrypt. NULL means this person cannot log in, which is every member. */
    passwordHash: text('password_hash'),
    dateOfBirth: date('date_of_birth'),
    gender: genderType('gender'),
    status: userStatus('status').notNull().default('active'),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    registeredByUserId: uuid('registered_by_user_id'),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
    /** Soft delete — history must survive. */
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
  },
  (table) => [
    // Partial, NOT a plain .unique(): a soft-deleted row must not squat a phone
    // number forever. A plain UNIQUE would cover deleted rows too.
    uniqueIndex('users_phone_active_uniq')
      .on(table.phone)
      .where(sql`${table.deletedAt} is null`),
    index('users_status_idx').on(table.status),
  ],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

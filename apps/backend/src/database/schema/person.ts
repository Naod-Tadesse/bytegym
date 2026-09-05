import { sql } from 'drizzle-orm';
import {
  date,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

export const genderType = pgEnum('gender_type', ['male', 'female']);

/**
 * One row per human, forever. There is NO person_type column — what a person is
 * comes from which profile rows exist (staff, member_profiles).
 *
 * Pure identity — name, phone, date of birth, gender. NO credentials
 * (accounts) and NO status of its own.
 *
 * There is deliberately no person.status: every state anyone wanted from it
 * belongs to something more specific. Can they sign in -> accounts.status. Are
 * they barred from the premises -> member.suspended. Do they still work here ->
 * staff.employment_status. A status here would only duplicate one of those and
 * then drift from it.
 */
export const person = pgTable(
  'person',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    firstName: varchar('first_name', { length: 80 }).notNull(),
    lastName: varchar('last_name', { length: 80 }).notNull(),
    /** Login handle for staff, contact handle for members. One normalised format. */
    phone: varchar('phone', { length: 30 }).notNull(),
    dateOfBirth: date('date_of_birth'),
    gender: genderType('gender'),
    registeredByPersonId: uuid('registered_by_person_id'),
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
    uniqueIndex('person_phone_active_uniq')
      .on(table.phone)
      .where(sql`${table.deletedAt} is null`),
  ],
);

export type Person = typeof person.$inferSelect;
export type NewPerson = typeof person.$inferInsert;

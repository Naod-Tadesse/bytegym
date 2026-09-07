import { sql } from 'drizzle-orm';
import {
  boolean,
  integer,
  numeric,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

/**
 * The products the gym sells: "1 Month", "3 Months", "Annual".
 *
 * No `deletedAt`. Like branches, a plan is retired by flipping `isActive` —
 * every membership ever sold points at its row, so hard-deleting one would
 * orphan history. With no soft delete there is no dead row holding a name
 * hostage, so the partial-unique-index dance the soft-deleting tables need
 * does not apply.
 *
 * Uniqueness is on `lower(name)`, NOT on `name`. The service compares names
 * case-insensitively, and a pre-check without a matching index is exactly the
 * TOCTOU race CLAUDE.md warns about: two concurrent requests for "Gold" and
 * "gold" both see no duplicate, a case-sensitive constraint accepts both, and
 * the gym ends up with two plans the application itself considers the same.
 * `lower()` on text is IMMUTABLE, so it is legal in an index — unlike the
 * timestamptz cast that forced check_ins to carry its own date column.
 */
export const membershipPlans = pgTable(
  'membership_plans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 120 }).notNull(),
    description: varchar('description', { length: 500 }),
    durationDays: integer('duration_days').notNull(),
    /**
     * Money is `numeric(12,2)` and stays a **string** in TypeScript — Drizzle's
     * default for `numeric`, deliberately not `{ mode: 'number' }`. A float
     * cannot represent 1500.10 exactly, and once a price becomes a float every
     * total built from it inherits the error. Every sum over this column is
     * computed in SQL, never in JS.
     */
    price: numeric('price', { precision: 12, scale: 2 }).notNull(),
    /**
     * The one-off joining fee, charged only the first time a member ever buys
     * anything. A property of the product, not of the sale: two plans may join
     * on different terms, and the front desk should never type a number.
     *
     * Defaults to `'0'` so an existing plan — and any create that omits it —
     * simply charges nothing extra, which is the pre-existing behaviour.
     *
     * String-typed `numeric(12,2)` for the same reason as `price`.
     */
    registrationFee: numeric('registration_fee', { precision: 12, scale: 2 })
      .notNull()
      .default('0'),
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
    uniqueIndex('membership_plans_name_lower_uniq').on(
      sql`lower(${table.name})`,
    ),
  ],
);

export type MembershipPlan = typeof membershipPlans.$inferSelect;
export type NewMembershipPlan = typeof membershipPlans.$inferInsert;

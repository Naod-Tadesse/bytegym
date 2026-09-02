/** Injection token for the Drizzle handle. */
export const DRIZZLE = Symbol('DRIZZLE');

/** Injection token for the pool + Drizzle pair, used to close the pool. */
export const DATABASE_CLIENT = Symbol('DATABASE_CLIENT');

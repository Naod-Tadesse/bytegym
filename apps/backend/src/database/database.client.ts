import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool, type PoolConfig } from 'pg';

export type Database = NodePgDatabase;

/**
 * The handle passed to a `db.transaction()` callback. Derived from Database
 * rather than named directly, so it tracks the driver's own generics.
 *
 * Anything reading or writing inside a transaction must take `Database |
 * Transaction` and be handed the `tx` — closing over `this.db` silently runs
 * on a different pooled connection, outside the transaction.
 */
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];

export interface DatabaseClient {
  db: Database;
  pool: Pool;
}

/**
 * Builds the pool and the Drizzle handle together so the caller owns the
 * lifecycle and can close the pool on shutdown.
 */
export function createDatabaseClient(
  connectionString: string,
  config: PoolConfig = {},
): DatabaseClient {
  const pool = new Pool({ connectionString, max: 10, ...config });

  return { db: drizzle({ client: pool }), pool };
}

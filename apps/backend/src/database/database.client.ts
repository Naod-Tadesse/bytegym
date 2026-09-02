import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool, type PoolConfig } from 'pg';

export type Database = NodePgDatabase;

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

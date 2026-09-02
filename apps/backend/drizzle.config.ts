import 'dotenv/config';
import { defineConfig } from 'drizzle-kit';

// Paths are relative to the workspace root: the db-* targets in package.json run
// from there so that `dotenv/config` picks up the root .env.
const url = process.env.DATABASE_URL;

if (!url) {
  throw new Error('DATABASE_URL is not set. Copy .env.example to .env first.');
}

export default defineConfig({
  dialect: 'postgresql',
  schema: './apps/backend/src/database/schema/index.ts',
  out: './apps/backend/drizzle',
  dbCredentials: { url },
  verbose: true,
  strict: true,
});

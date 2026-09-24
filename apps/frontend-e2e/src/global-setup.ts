import { request } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { API, DATABASE_URL, WEB_URL, manifestPath } from './support/env';
import { closeDb, sql } from './support/db';

function fail(message: string): never {
  throw new Error(`\n\n  e2e setup failed:\n  ${message}\n`);
}

export default async function globalSetup(): Promise<void> {
  // Every record this run creates is tagged with it, and teardown deletes by it.
  process.env.E2E_RUN_ID ??= Date.now().toString(36);
  mkdirSync(dirname(manifestPath()), { recursive: true });

  const ctx = await request.newContext();

  // 1. Both servers must already be up. The suite never starts them — they are
  //    the developer's own permanently-running stack.
  let health: { status: string; database: string; users: number };
  try {
    const res = await ctx.get(`${API}/health`, { timeout: 10_000 });
    if (!res.ok()) fail(`GET ${API}/health returned ${res.status()}`);
    health = await res.json();
  } catch {
    fail(
      `the backend is not answering on ${API}.\n` +
        `  Start it with:  npx nx run @org/backend:serve`,
    );
  }
  if (health.database !== 'up') fail(`the API reports database: ${health.database}`);

  try {
    const res = await ctx.get(WEB_URL, { timeout: 10_000 });
    if (!res.ok()) fail(`GET ${WEB_URL} returned ${res.status()}`);
  } catch {
    fail(
      `the frontend is not answering on ${WEB_URL}.\n` +
        `  Start it with:  npx nx run @org/frontend:serve`,
    );
  }

  // 2. The suite cleans up in SQL, so the database it connects to must be the
  //    same one the API is serving. /api/health returns count(person), so
  //    comparing it against our own count proves it without writing anything.
  //    Without this guard a stale DATABASE_URL would leave every created row
  //    behind and delete rows from an unrelated database.
  let mine: number;
  try {
    const rows = await sql<{ count: string }>('select count(*)::int as count from person');
    mine = Number(rows[0].count);
  } catch (err) {
    fail(
      `cannot connect to ${DATABASE_URL.replace(/:[^:@]*@/, ':***@')}\n` +
        `  ${(err as Error).message}`,
    );
  }
  if (mine !== health.users) {
    fail(
      `the API and this suite are looking at different databases.\n` +
        `  ${API}/health reports ${health.users} people; ${DATABASE_URL.replace(
          /:[^:@]*@/,
          ':***@',
        )} has ${mine}.\n` +
        `  Teardown would not be able to clean up. Check DATABASE_URL.`,
    );
  }

  // 3. The seed must have run — every persona hangs off Main Branch and the
  //    owner account.
  const branches = await sql<{ name: string }>(
    `select name from branches where name = 'Main Branch'`,
  );
  if (!branches.length) {
    fail(`no "Main Branch" — run:  npx nx run @org/backend:db-seed`);
  }

  await ctx.dispose();
  await closeDb();

  console.log(
    `\n  e2e run ${process.env.E2E_RUN_ID} against ${API} (${health.users} people on file)\n`,
  );
}

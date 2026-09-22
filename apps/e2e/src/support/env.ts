import { config as loadEnv } from 'dotenv';
import { resolve } from 'node:path';

export const WORKSPACE_ROOT = resolve(__dirname, '..', '..', '..', '..');
export const E2E_ROOT = resolve(__dirname, '..', '..');

// The backend reads .env.local first, then .env. Mirror that so the suite talks
// to the same database the running server does. dotenv never overrides a
// variable that is already set, so CI's `env:` block still wins.
loadEnv({ path: resolve(WORKSPACE_ROOT, '.env.local') });
loadEnv({ path: resolve(WORKSPACE_ROOT, '.env') });

export const API_URL = process.env.E2E_API_URL ?? 'http://localhost:3000';
export const WEB_URL = process.env.E2E_WEB_URL ?? 'http://localhost:4200';
export const API = `${API_URL}/api`;

export const DATABASE_URL =
  process.env.DATABASE_URL ??
  'postgresql://bytegym:bytegym@localhost:5432/bytegym';

/** The account the seed creates. Every arrange step runs as this persona. */
export const OWNER = {
  phone: process.env.ADMIN_PHONE ?? '0911000000',
  password: process.env.ADMIN_PASSWORD ?? 'Admin@123',
};

/** Set by global-setup; every created record is tagged with it. */
export const RUN_ID = () => process.env.E2E_RUN_ID ?? 'local';

export const manifestPath = () =>
  resolve(E2E_ROOT, 'test-output', `manifest-${RUN_ID()}.json`);

export const storageStatePath = (key: string) =>
  resolve(E2E_ROOT, 'playwright', '.auth', `${key}.json`);

export const KEEP_DATA = process.env.E2E_KEEP_DATA === '1';

/**
 * The gym's day, computed the way the server computes it. Never use
 * `toISOString().slice(0,10)` — between 00:00 and 03:00 in Addis that is still
 * yesterday in UTC, and every gym-day assertion would be off by one.
 */
export const GYM_TIME_ZONE = 'Africa/Addis_Ababa';

export function gymToday(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: GYM_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

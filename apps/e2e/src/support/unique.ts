import { RUN_ID } from './env';

/**
 * The gym's real test handset, hard-coded as the SMS allowlist default in
 * apps/backend/src/notifications/sms/sms.service.ts. SMS_API_KEY in .env is a
 * live key, so a generated phone that happened to equal this number could put a
 * real text on a real handset. Never generate it.
 */
export const REAL_TEST_HANDSET = '0968931531';
const NEVER_GENERATE = new Set([REAL_TEST_HANDSET, '0911000000']);

/** `E2E-<runId>-w<worker>` — the prefix every created record carries. */
export const scopeFor = (workerIndex: number) =>
  `E2E-${RUN_ID()}-w${workerIndex}`;

let counter = 0;

export function uniqueName(scope: string, kind: string): string {
  counter += 1;
  return `${scope}-${kind}-${counter}`;
}

/**
 * A phone matching /^0[79]\d{8}$/. Random rather than sequential because
 * workers do not coordinate; `person_phone_active_uniq` is partial on
 * `deleted_at is null`, so collisions only matter against live rows.
 */
export function uniquePhone(): string {
  for (;;) {
    const prefix = Math.random() < 0.5 ? '09' : '07';
    const rest = String(Math.floor(Math.random() * 1e8)).padStart(8, '0');
    const phone = `${prefix}${rest}`;
    if (!NEVER_GENERATE.has(phone)) return phone;
  }
}

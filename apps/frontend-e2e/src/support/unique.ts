import { RUN_ID } from './env';

/**
 * Numbers a generated phone must never collide with.
 *
 * `0911000000` is the seeded owner — reusing it would break every persona.
 * `0968931531` is the gym's own handset, which used to be the SMS allowlist's
 * default recipient. That allowlist is gone, so nothing stops a message to any
 * number now; all the more reason not to invent this one by accident.
 *
 * Note this protects only these two. Every other number `uniquePhone()`
 * produces is a real Ethiopian mobile belonging to someone, which is why the
 * sending test in sms.spec.ts refuses to run with a provider configured.
 */
export const GYM_HANDSET = '0968931531';
const SEEDED_OWNER = '0911000000';
const NEVER_GENERATE = new Set([GYM_HANDSET, SEEDED_OWNER]);

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

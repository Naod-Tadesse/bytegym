import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { WORKSPACE_ROOT } from './env';

/**
 * The app's own English strings, read at runtime.
 *
 * Specs that select by visible text must use these rather than retyping them:
 * a great many contain typographic characters — the ellipsis in every
 * "Search …" placeholder, the curly apostrophe in "Today's check-ins", em
 * dashes throughout — so a hand-typed "Search plans..." silently never matches.
 *
 * Read from disk rather than imported so this does not reach across the project
 * boundary into apps/frontend at compile time.
 */
const strings: Record<string, unknown> = JSON.parse(
  readFileSync(
    resolve(
      WORKSPACE_ROOT,
      'apps/frontend/src/i18n/locales/en/common.json',
    ),
    'utf8',
  ),
);

/** `t('members.title')` — throws on a missing key rather than returning it. */
export function t(key: string): string {
  const value = key
    .split('.')
    .reduce<unknown>(
      (acc, part) =>
        acc && typeof acc === 'object'
          ? (acc as Record<string, unknown>)[part]
          : undefined,
      strings,
    );
  if (typeof value !== 'string') {
    throw new Error(`i18n key "${key}" is missing from en/common.json`);
  }
  return value;
}

/**
 * Strings that are hardcoded English in TSX rather than i18n keys. Listed here
 * so nobody looks for them with t() and so it is obvious they are intentional.
 */
export const LITERAL = {
  emptyTable: 'No results.',
  reset: 'Reset',
  view: 'View',
  toggleColumns: 'Toggle columns',
  rowsPerPage: 'Rows per page',
  confirm: 'Confirm',
  cancel: 'Cancel',
  noResultsFound: 'No results found.',
  loading: 'Loading...',
} as const;

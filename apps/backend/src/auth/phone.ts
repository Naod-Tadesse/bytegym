/**
 * Ethiopian mobile numbers in local form: 07… or 09… followed by 8 digits.
 *
 * We deliberately store and display this local format rather than +251…:
 * staff type the number they know, and nobody has to think about a country
 * code to sign in. If SMS is added later, prefix +251 at the SMS boundary —
 * not in the database.
 */
export const PHONE_REGEX = /^0[79]\d{8}$/;

export const PHONE_MESSAGE =
  'Phone must start with 07 or 09 followed by 8 digits, e.g. 0912345678';

/** Strips spaces, dashes and a +251 / 251 prefix so paste-from-contacts works. */
export function normalisePhone(input: string): string {
  const digitsOnly = input.replace(/[\s-()]/g, '');

  if (digitsOnly.startsWith('+251')) {
    return `0${digitsOnly.slice(4)}`;
  }
  if (digitsOnly.startsWith('251')) {
    return `0${digitsOnly.slice(3)}`;
  }
  return digitsOnly;
}

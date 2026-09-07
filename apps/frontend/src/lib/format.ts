import { format, parseISO } from 'date-fns';

/**
 * Money arrives from the API as a numeric string ("1500.00") and must stay one:
 * every total is computed in SQL with `SUM()`, never in JS. `Number()` here is
 * for display only — never feed its result back into a payload or add two of
 * them together.
 */
export const formatBirr = (amount: string) =>
  `${Number(amount).toLocaleString('en-ET', { minimumFractionDigits: 2 })} ETB`;

/**
 * Whether a numeric string is zero, decided **without parsing it**.
 *
 * `Number(balance) !== 0` would be the obvious test and is exactly what the
 * string representation exists to avoid; `balance !== '0.00'` is worse still,
 * since the same zero arrives as `0`, `0.00` or `-0.00` depending on how
 * Postgres rendered the subtraction. Matching the digits answers it outright.
 */
export const isZeroAmount = (amount: string) =>
  /^-?0+(\.0+)?$/.test(amount.trim());

/**
 * Whether a balance is money the member still owes, as opposed to nothing or an
 * overpayment. A balance goes negative when someone hands over more than is
 * outstanding — real enough at a front desk that the API documents it — and a
 * credit painted in the same alarming colour as a debt reads as the opposite of
 * what it is.
 */
export const isAmountOwed = (amount: string) =>
  !isZeroAmount(amount) && !amount.trim().startsWith('-');

/** A money string as exact cents. `"1500.5"` and `"1500.50"` both give 150050n. */
const toCents = (amount: string) => {
  const trimmed = amount.trim();
  const isNegative = trimmed.startsWith('-');
  const [whole, fraction = ''] = trimmed.replace(/^[+-]/, '').split('.');
  const cents =
    BigInt(whole || '0') * 100n + BigInt(`${fraction}00`.slice(0, 2));
  return isNegative ? -cents : cents;
};

/**
 * Adds two money strings and returns one, **without ever parsing them as
 * floats**: `0.1 + 0.2` is `0.30000000000000004` in JS, and the total quoted at
 * the desk has to be the same figure the server will store. The sum is done in
 * `BigInt` cents, so it is exact at any size the column can hold.
 *
 * The server remains the authority — a sold membership comes back carrying its
 * own `amountDue`. This exists only to show the breakdown *before* the sale is
 * made, where there is no server figure to show yet. Never send the result
 * anywhere: `POST /memberships` deliberately takes no amount.
 */
export const addAmounts = (a: string, b: string) => {
  const total = toCents(a) + toCents(b);
  const absolute = total < 0n ? -total : total;
  const sign = total < 0n ? '-' : '';
  return `${sign}${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}`;
};

/** `yyyy-MM-dd` or a full ISO timestamp, rendered compactly. */
export const formatDate = (iso: string) => format(parseISO(iso), 'dd MMM yyyy');

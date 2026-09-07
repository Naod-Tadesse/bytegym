import { z } from 'zod';

/**
 * Money is validated as a string and sent as a string — the same shape the API
 * stores and returns.
 *
 * The leading lookahead rejects an all-zero amount without parsing it.
 * `Number(value) > 0` would be the obvious refinement and is exactly what the
 * string representation exists to avoid; and `z.coerce.number()` is not an
 * option either — coercion widens the schema's *input* type to `unknown`, and
 * TanStack Form's `StandardSchemaV1` check then rejects it (see the note in
 * `features/membership-plans/data/schema.ts`).
 */
const amount = z
  .string()
  // The same pattern and length `RecordPaymentDto` validates against, so a
  // rejection is caught here with a readable message rather than as a 400.
  .max(13)
  .regex(
    /^(?!0+(\.0{1,2})?$)\d+(\.\d{1,2})?$/,
    'Enter an amount above zero, like 800 or 800.00',
  );

/**
 * Three inputs, hence a dialog.
 *
 * `memberId` and `membershipId` are not here: they come from the membership row
 * the dialog was opened over, never from something typed — and `membershipId`
 * is now required by the API, so this dialog has no standalone form. `note` is
 * not offered either: `reference` is the field a receptionist actually fills in
 * (a Telebirr transaction number), and a second free-text box beside it goes
 * unused.
 *
 * `amount` stays, and stays typed: this is the instalment path. The sale itself
 * computes what is owed, but "800 now, the rest on Friday" means the figure
 * handed over here is a partial one only the person at the desk knows.
 */
export const recordPaymentSchema = z.object({
  amount,
  method: z.enum(['cash', 'telebirr', 'cbe_birr', 'bank_transfer', 'card']),
  reference: z.string().max(80),
});

/**
 * Voiding is a form, not a bare confirm: the reason is required, and it is the
 * only account of why the row is there that an audit will ever get.
 */
export const voidPaymentSchema = z.object({
  reason: z
    .string()
    .trim()
    .min(1, 'Say why this payment is being voided')
    .max(255),
});

export type RecordPaymentFormData = z.infer<typeof recordPaymentSchema>;
export type VoidPaymentFormData = z.infer<typeof voidPaymentSchema>;

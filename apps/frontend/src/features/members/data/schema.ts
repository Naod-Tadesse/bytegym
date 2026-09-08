import { z } from 'zod';

import { PHONE_MESSAGE, PHONE_REGEX } from '@/features/auth/data/schema';

/** Optional in the API too — the pickers leave them empty until chosen. */
const optionalDate = z.string();
const optionalGender = z.enum(['', 'male', 'female']);

export const createMemberSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(80),
  lastName: z.string().min(1, 'Last name is required').max(80),
  // Local Ethiopian form, the same rule the API validates against. Never
  // +251 — see the note on `FormTextField` in create-member.tsx.
  phone: z.string().regex(PHONE_REGEX, PHONE_MESSAGE),
  dateOfBirth: optionalDate,
  gender: optionalGender,
  // No memberCode — the server assigns it (MBR00001, MBR00002, …).
  branchId: z.string().min(1, 'Branch is required'),
  emergencyContactName: z.string().max(120),
  /**
   * Deliberately looser than `phone`: the column is 30 characters, and a next
   * of kin is as likely to leave a landline or a number with an extension as a
   * local mobile. Rejecting those here would block input the API accepts.
   */
  emergencyContactPhone: z.string().max(30),
});

/** Phone is immutable, like staff — the API does not accept it on update. */
export const editMemberSchema = createMemberSchema.omit({ phone: true });

/**
 * Selling a membership is also taking the payment for it, so one form covers
 * both — and at six fields across two decisions it is a page, not a dialog.
 *
 * There is no start date, no `endsOn` and no `price`. A membership begins the
 * day it is sold — the server takes the gym's today, so a browser on the wrong
 * clock cannot shift it — and the end date and price are derived from the plan
 * and snapshotted. None of the three is ours to send.
 *
 * **There is no `amount` here, and there must not be.** The server computes the
 * amount due from the plan's price plus its registration fee, charging the fee
 * only when the member has never held a membership. A typed amount would be a
 * second, unauthoritative answer to a question the server has already settled.
 *
 * `method` needs no "required" rule because it cannot be empty: it is seeded
 * with `cash` and offers a closed enum. `takePaymentNow` off, or
 * `isComplimentary` on, means no `payment` object is sent at all.
 */
export const sellMembershipSchema = z.object({
  planId: z.string().min(1, 'Plan is required'),
  isComplimentary: z.boolean(),
  takePaymentNow: z.boolean(),
  method: z.enum(['cash', 'telebirr', 'cbe_birr', 'bank_transfer', 'card']),
  reference: z.string().max(80),
});

export type SellMembershipFormData = z.infer<typeof sellMembershipSchema>;

export type CreateMemberFormData = z.infer<typeof createMemberSchema>;
export type EditMemberFormData = z.infer<typeof editMemberSchema>;

/** `''` means "not set" in the form but would fail validation on the API. */
export const orUndefined = (value: string) => value.trim() || undefined;

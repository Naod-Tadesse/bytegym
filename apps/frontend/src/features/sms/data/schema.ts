import { z } from 'zod';

import { PHONE_MESSAGE, PHONE_REGEX } from '@/features/auth/data/schema';

/**
 * A single SMS is 160 GSM-7 characters and longer text is billed per part, so
 * the ceiling is the API's — four parts. Enforced here as well as there so the
 * counter under the box and the rejection agree.
 */
export const MAX_MESSAGE_LENGTH = 640;

const message = z
  .string()
  .min(1, 'Write something to send')
  .max(MAX_MESSAGE_LENGTH, `At most ${MAX_MESSAGE_LENGTH} characters`);

export const sendSmsSchema = z.object({
  phone: z.string().regex(PHONE_REGEX, PHONE_MESSAGE),
  message,
});

export const broadcastSchema = z
  .object({
    audience: z.enum(['all', 'plan']),
    planId: z.string(),
    message,
  })
  // A plan audience with no plan chosen would silently become "everyone" on
  // the server, which is the most expensive possible misunderstanding.
  .refine((value) => value.audience !== 'plan' || value.planId.length > 0, {
    message: 'Choose a plan',
    path: ['planId'],
  });

export const smsSettingsSchema = z.object({
  reminderEnabled: z.boolean(),
  reminderDaysBefore: z
    .number()
    .int()
    .min(1, 'At least a day')
    .max(365, 'At most a year'),
  // A string, because `FormSelectField` stores what the option carries. It is
  // turned back into a number when the payload is built — the API takes 0-23.
  reminderHour: z.string().min(1),
  reminderTemplate: message,
});

export type SendSmsFormData = z.infer<typeof sendSmsSchema>;
export type BroadcastFormData = z.infer<typeof broadcastSchema>;
export type SmsSettingsFormData = z.infer<typeof smsSettingsSchema>;

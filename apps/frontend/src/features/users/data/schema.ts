import { z } from 'zod';

import { confirmMatches, password } from '@/features/staff/data/schema';

/** Administrative reset — no current password needed. */
export const resetPasswordSchema = z
  .object({
    newPassword: password,
    confirmPassword: z.string(),
  })
  .refine((data) => confirmMatches(data, 'newPassword'), {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

/**
 * What a signed-in user may reach. An empty `roleIds` is valid and meaningful:
 * an account with no roles can sign in and do nothing, which is a legitimate
 * thing to leave someone at while their permissions are being decided.
 */
export const editAccessSchema = z.object({
  roleIds: z.array(z.string()),
  dataScope: z.enum(['branch', 'all']),
});

export type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;
export type EditAccessFormData = z.infer<typeof editAccessSchema>;

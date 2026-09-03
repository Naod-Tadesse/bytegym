import { z } from 'zod';

/**
 * Ethiopian mobile in local form: 07… or 09… then 8 digits.
 * Mirrors PHONE_REGEX in apps/backend/src/auth/phone.ts — keep them in step.
 */
const PHONE_REGEX = /^0[79]\d{8}$/;

export const loginSchema = z.object({
  phone: z
    .string()
    .min(1, 'Phone number is required')
    .regex(
      PHONE_REGEX,
      'Phone must start with 07 or 09 followed by 8 digits, e.g. 0912345678',
    ),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export type LoginFormData = z.infer<typeof loginSchema>;

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(6, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'New password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type ChangePasswordFormData = z.infer<typeof changePasswordSchema>;

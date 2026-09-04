import { z } from 'zod';

import { PHONE_MESSAGE, PHONE_REGEX } from '@/features/auth/data/schema';

/** Optional in the API too — the picker leaves them empty until chosen. */
const optionalDate = z.string();
const optionalGender = z.enum(['', 'male', 'female']);

const password = z.string().min(8, 'Password must be at least 8 characters');

/** The two boxes must agree — a typo guard, never sent to the API. */
const confirmMatches = <T extends { confirmPassword: string }>(
  data: T,
  field: keyof T,
) => data.confirmPassword === data[field];

export const createStaffSchema = z
  .object({
    firstName: z.string().min(1, 'First name is required').max(80),
    lastName: z.string().min(1, 'Last name is required').max(80),
    phone: z.string().regex(PHONE_REGEX, PHONE_MESSAGE),
    password,
    confirmPassword: z.string(),
    dateOfBirth: optionalDate,
    gender: optionalGender,
    staffCode: z.string().min(1, 'Staff code is required').max(24),
    primaryBranchId: z.string().min(1, 'Branch is required'),
    jobTitle: z.string().min(1, 'Job title is required').max(80),
    hiredOn: z.string().min(1, 'Hire date is required'),
    dataScope: z.enum(['branch', 'all']),
    roleIds: z.array(z.string()),
  })
  .refine((data) => confirmMatches(data, 'password'), {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

/** Administrative reset from the staff list — no current password needed. */
export const resetPasswordSchema = z
  .object({
    newPassword: password,
    confirmPassword: z.string(),
  })
  .refine((data) => confirmMatches(data, 'newPassword'), {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

/** Phone, password and staff code are immutable — the API rejects them here. */
export const editStaffSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(80),
  lastName: z.string().min(1, 'Last name is required').max(80),
  dateOfBirth: optionalDate,
  gender: optionalGender,
  primaryBranchId: z.string().min(1, 'Branch is required'),
  jobTitle: z.string().min(1, 'Job title is required').max(80),
  employmentStatus: z.enum(['active', 'on_leave', 'terminated']),
  dataScope: z.enum(['branch', 'all']),
  roleIds: z.array(z.string()),
});

export type CreateStaffFormData = z.infer<typeof createStaffSchema>;
export type EditStaffFormData = z.infer<typeof editStaffSchema>;

/** `''` means "not set" in the form but would fail validation on the API. */
export const orUndefined = (value: string) => value.trim() || undefined;

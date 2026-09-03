import { z } from 'zod';

import { PHONE_MESSAGE, PHONE_REGEX } from '@/features/auth/data/schema';

/** Optional in the API too — the picker leaves them empty until chosen. */
const optionalDate = z.string();
const optionalGender = z.enum(['', 'male', 'female']);

export const createStaffSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(80),
  lastName: z.string().min(1, 'Last name is required').max(80),
  phone: z.string().regex(PHONE_REGEX, PHONE_MESSAGE),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  dateOfBirth: optionalDate,
  gender: optionalGender,
  staffCode: z.string().min(1, 'Staff code is required').max(24),
  primaryBranchId: z.string().min(1, 'Branch is required'),
  jobTitle: z.string().min(1, 'Job title is required').max(80),
  hiredOn: z.string().min(1, 'Hire date is required'),
  roleIds: z.array(z.string()),
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
  roleIds: z.array(z.string()),
});

export type CreateStaffFormData = z.infer<typeof createStaffSchema>;
export type EditStaffFormData = z.infer<typeof editStaffSchema>;

/** `''` means "not set" in the form but would fail validation on the API. */
export const orUndefined = (value: string) => value.trim() || undefined;

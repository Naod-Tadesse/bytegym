import { z } from 'zod';

import { PHONE_MESSAGE, PHONE_REGEX } from '@/features/auth/data/schema';

/** Optional in the API too — the picker leaves them empty until chosen. */
const optionalDate = z.string();
const optionalGender = z.enum(['', 'male', 'female']);

/**
 * Hiring can set a login in one go, so the credential rules live here — but
 * `features/users` owns every *later* change to one and reuses these, so the
 * two screens cannot disagree about what a valid password is.
 */
export const PASSWORD_MIN = 8;
export const PASSWORD_MESSAGE = 'Password must be at least 8 characters';

export const password = z.string().min(PASSWORD_MIN, PASSWORD_MESSAGE);

/** The two boxes must agree — a typo guard, never sent to the API. */
export const confirmMatches = <T extends { confirmPassword: string }>(
  data: T,
  field: keyof T,
) => data.confirmPassword === data[field];

/**
 * Credentials live on an `accounts` row now, and a job title with
 * `canHaveAccount: false` cannot have one — so the password pair is required
 * only when the chosen title allows a login, and the form drops the fields
 * entirely when it does not.
 *
 * `canHaveAccount` is form state mirroring the picked title, never sent to
 * the API. It is carried here rather than looked up from the combobox's
 * options because a server-side search can page the chosen row back out of
 * `options`, and the answer must not change when it does.
 *
 * `.superRefine()` rather than `.refine()`: two independent issues (missing /
 * too short, and mismatched) need distinct paths, and the object stays
 * extendable.
 */
export const createStaffSchema = z
  .object({
    firstName: z.string().min(1, 'First name is required').max(80),
    lastName: z.string().min(1, 'Last name is required').max(80),
    phone: z.string().regex(PHONE_REGEX, PHONE_MESSAGE),
    // Bare strings: conditionally required below, not always.
    password: z.string(),
    confirmPassword: z.string(),
    dateOfBirth: optionalDate,
    gender: optionalGender,
    // No staffCode — the server generates it (ST00001, ST00002, …).
    primaryBranchId: z.string().min(1, 'Branch is required'),
    jobTitleId: z.string().min(1, 'Job title is required'),
    hiredOn: z.string().min(1, 'Hire date is required'),
    dataScope: z.enum(['branch', 'all']),
    roleIds: z.array(z.string()),
    canHaveAccount: z.boolean(),
  })
  .superRefine((data, ctx) => {
    // No login for this title: the fields are not on screen, so anything left
    // in them is stale and must not block the submit.
    if (!data.canHaveAccount) return;

    // `''` is absent, not a too-short password — say "required" instead.
    if (!data.password) {
      ctx.addIssue({
        code: 'custom',
        message: 'Password is required',
        path: ['password'],
      });
    } else if (data.password.length < PASSWORD_MIN) {
      ctx.addIssue({
        code: 'custom',
        message: PASSWORD_MESSAGE,
        path: ['password'],
      });
    }

    if (!confirmMatches(data, 'password')) {
      ctx.addIssue({
        code: 'custom',
        message: 'Passwords do not match',
        path: ['confirmPassword'],
      });
    }
  });

/**
 * Employment only. Phone, password and staff code are immutable — the API
 * rejects them here — and `dataScope` / `roleIds` are access decisions, which
 * belong to `features/users`, not to the HR record.
 */
export const editStaffSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(80),
  lastName: z.string().min(1, 'Last name is required').max(80),
  dateOfBirth: optionalDate,
  gender: optionalGender,
  primaryBranchId: z.string().min(1, 'Branch is required'),
  jobTitleId: z.string().min(1, 'Job title is required'),
  employmentStatus: z.enum(['active', 'on_leave', 'terminated']),
});

/**
 * Giving an existing employee a login. No `staffId`: the row this opens from
 * is the subject, which is the whole reason it lives on Staff rather than on
 * Users, where that person cannot appear.
 */
export const grantAccessSchema = z
  .object({
    // Empty is valid: someone who can sign in but do nothing yet is a real
    // state, not a mistake.
    roleIds: z.array(z.string()),
    password,
    confirmPassword: z.string(),
  })
  .refine((data) => confirmMatches(data, 'password'), {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type GrantAccessFormData = z.infer<typeof grantAccessSchema>;
export type CreateStaffFormData = z.infer<typeof createStaffSchema>;
export type EditStaffFormData = z.infer<typeof editStaffSchema>;

/** `''` means "not set" in the form but would fail validation on the API. */
export const orUndefined = (value: string) => value.trim() || undefined;

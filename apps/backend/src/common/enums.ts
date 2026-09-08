import {
  accountStatus,
  dataScope,
  employmentStatus,
  genderType,
  paymentMethod,
  smsKind,
  smsStatus,
} from '../database/schema';

/**
 * Sourced from the Drizzle pgEnums rather than retyped, so the OpenAPI schema
 * and the database column cannot drift apart.
 *
 * Every `@ApiProperty` using one of these must also pass the matching
 * `enumName` below. Without a name, each usage emits a separate anonymous
 * inline enum and client codegen produces several unrelated string-union types
 * for what is one concept.
 */
export const GENDERS = genderType.enumValues;
export const ACCOUNT_STATUSES = accountStatus.enumValues;
export const EMPLOYMENT_STATUSES = employmentStatus.enumValues;
export const DATA_SCOPES = dataScope.enumValues;
export const PAYMENT_METHODS = paymentMethod.enumValues;
export const SMS_KINDS = smsKind.enumValues;
export const SMS_STATUSES = smsStatus.enumValues;

/**
 * The one set here that is NOT a pgEnum, deliberately: whether a member is
 * active, expired or has never joined is derived from the memberships table on
 * every read and never stored. A column would need a nightly job, and the day
 * that job fails the column lies.
 *
 * It still needs an `enumName` for the same reason the others do — without one,
 * every usage emits a separate anonymous inline enum.
 */
export const MEMBERSHIP_STATUSES = [
  'active',
  // Sold and paid for, but every period still lies ahead — an early renewal
  // taken out before the previous one lapsed, or a member who walked in today
  // for a membership starting next month. Distinct from `expired`, which means
  // they owe money, and from `never`, which means they have bought nothing.
  'expired',
  'never',
] as const;

/**
 * Why the door was refused. The second set here that is not a pgEnum, and for a
 * different reason from the first: nothing stores it at all. It is computed
 * when a check-in is refused and travels only in the 403 body.
 *
 * It exists because **the frontend must branch on a code, never on the prose**.
 * Each of these three leads to a different action at the desk — fetch a manager,
 * sell a renewal, sign them up — so the
 * message wording will keep being tuned, and a UI matching on the sentence
 * would break silently the first time it is.
 */
export const CHECKIN_REFUSAL_REASONS = [
  /** Barred from the premises. The one `checkin.override` cannot wave through. */
  'suspended',
  /** Has bought before; nothing covers today. They owe money. */
  'expired',
  /** Never bought one. Not a lapse — a sale that has not happened yet. */
  'none',
] as const;

export const GENDER_ENUM_NAME = 'Gender';
export const ACCOUNT_STATUS_ENUM_NAME = 'AccountStatus';
export const EMPLOYMENT_STATUS_ENUM_NAME = 'EmploymentStatus';
export const DATA_SCOPE_ENUM_NAME = 'DataScope';
export const MEMBERSHIP_STATUS_ENUM_NAME = 'MembershipStatus';
export const CHECKIN_REFUSAL_REASON_ENUM_NAME = 'CheckInRefusalReason';
export const PAYMENT_METHOD_ENUM_NAME = 'PaymentMethod';
export const SMS_KIND_ENUM_NAME = 'SmsKind';
export const SMS_STATUS_ENUM_NAME = 'SmsStatus';

export type Gender = (typeof GENDERS)[number];
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];
export type EmploymentStatus = (typeof EMPLOYMENT_STATUSES)[number];
export type DataScope = (typeof DATA_SCOPES)[number];
export type MembershipStatus = (typeof MEMBERSHIP_STATUSES)[number];
export type CheckInRefusalReason = (typeof CHECKIN_REFUSAL_REASONS)[number];
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export type SmsKind = (typeof SMS_KINDS)[number];
export type SmsStatus = (typeof SMS_STATUSES)[number];

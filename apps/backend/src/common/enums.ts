import { employmentStatus, genderType, userStatus } from '../database/schema';

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
export const USER_STATUSES = userStatus.enumValues;
export const EMPLOYMENT_STATUSES = employmentStatus.enumValues;

export const GENDER_ENUM_NAME = 'Gender';
export const USER_STATUS_ENUM_NAME = 'UserStatus';
export const EMPLOYMENT_STATUS_ENUM_NAME = 'EmploymentStatus';

export type Gender = (typeof GENDERS)[number];
export type UserStatus = (typeof USER_STATUSES)[number];
export type EmploymentStatus = (typeof EMPLOYMENT_STATUSES)[number];

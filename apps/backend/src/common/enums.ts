import {
  accountStatus,
  dataScope,
  employmentStatus,
  genderType,
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

export const GENDER_ENUM_NAME = 'Gender';
export const ACCOUNT_STATUS_ENUM_NAME = 'AccountStatus';
export const EMPLOYMENT_STATUS_ENUM_NAME = 'EmploymentStatus';
export const DATA_SCOPE_ENUM_NAME = 'DataScope';

export type Gender = (typeof GENDERS)[number];
export type AccountStatus = (typeof ACCOUNT_STATUSES)[number];
export type EmploymentStatus = (typeof EMPLOYMENT_STATUSES)[number];
export type DataScope = (typeof DATA_SCOPES)[number];

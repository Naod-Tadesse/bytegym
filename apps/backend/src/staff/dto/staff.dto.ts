import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

import {
  DATA_SCOPE_ENUM_NAME,
  DATA_SCOPES,
  EMPLOYMENT_STATUS_ENUM_NAME,
  EMPLOYMENT_STATUSES,
  GENDER_ENUM_NAME,
  GENDERS,
  type DataScope,
  type EmploymentStatus,
  type Gender,
} from '../../common/enums';
import { normalisePhone, PHONE_MESSAGE, PHONE_REGEX } from '../../auth/phone';

/** Shared by both DTOs — a `+251…` paste normalises to local form. */
const PHONE_DESCRIPTION =
  'Ethiopian mobile in local form. `+251912345678` and `251912345678` are ' +
  'also accepted; both are normalised to `0912345678` before validation.';

export class CreateStaffDto {
  @ApiProperty({ type: String, maxLength: 80, example: 'Nadia' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  firstName!: string;

  @ApiProperty({ type: String, maxLength: 80, example: 'Reyes' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  lastName!: string;

  @ApiProperty({
    type: String,
    example: '0912345678',
    pattern: PHONE_REGEX.source,
    description: `${PHONE_DESCRIPTION} This is what they sign in with.`,
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? normalisePhone(value) : value,
  )
  @IsString()
  @Matches(PHONE_REGEX, { message: PHONE_MESSAGE })
  phone!: string;

  @ApiPropertyOptional({
    type: String,
    minLength: 8,
    description:
      'Their initial password. OMIT IT to create an employee with no system ' +
      'access at all — a cleaner — which creates no account row, so there is ' +
      'no credential to authenticate against. Only a job title with ' +
      '`canHaveAccount` accepts one. Changed later via /auth/change-password.',
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @ApiPropertyOptional({
    type: String,
    format: 'date',
    example: '1995-04-17',
    description: 'Date only, no time component.',
  })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional({ enum: [...GENDERS], enumName: GENDER_ENUM_NAME })
  @IsOptional()
  @IsIn([...GENDERS])
  gender?: Gender;

  // staffCode is deliberately absent — the server draws it from a sequence
  // (`ST00001`, `ST00002`, …). Anything sent here is stripped by whitelist.

  @ApiProperty({ type: String, format: 'uuid' })
  @IsUUID()
  primaryBranchId!: string;

  @ApiPropertyOptional({
    enum: [...DATA_SCOPES],
    enumName: DATA_SCOPE_ENUM_NAME,
    default: 'branch',
    description:
      '`branch` confines every query to primaryBranchId; `all` removes the ' +
      'filter. Only a caller who already has `all` may grant it.',
  })
  @IsOptional()
  @IsIn([...DATA_SCOPES])
  dataScope?: DataScope;

  @ApiProperty({
    type: String,
    format: 'uuid',
    description:
      'From GET /api/job-titles. Whether this person may hold a login is ' +
      'decided by the title’s `canHaveAccount`.',
  })
  @IsUUID()
  jobTitleId!: string;

  @ApiProperty({ type: String, format: 'date', example: '2026-01-15' })
  @IsDateString()
  hiredOn!: string;

  @ApiPropertyOptional({
    type: 'array',
    items: { type: 'string', format: 'uuid' },
    description: 'Omit or send [] to create the account with no permissions.',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  roleIds?: string[];
}

/** Phone, password and staff code are immutable — deliberately absent here. */
export class UpdateStaffDto {
  @ApiPropertyOptional({ type: String, maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  firstName?: string;

  @ApiPropertyOptional({ type: String, maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  lastName?: string;

  @ApiPropertyOptional({ type: String, format: 'date' })
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional({ enum: [...GENDERS], enumName: GENDER_ENUM_NAME })
  @IsOptional()
  @IsIn([...GENDERS])
  gender?: Gender;

  @ApiPropertyOptional({ type: String, format: 'uuid' })
  @IsOptional()
  @IsUUID()
  primaryBranchId?: string;

  @ApiPropertyOptional({
    enum: [...DATA_SCOPES],
    enumName: DATA_SCOPE_ENUM_NAME,
    description:
      'Changing this revokes the member’s sessions — their live token carries ' +
      'the old scope until they sign in again.',
  })
  @IsOptional()
  @IsIn([...DATA_SCOPES])
  dataScope?: DataScope;

  @ApiPropertyOptional({ type: String, format: 'uuid' })
  @IsOptional()
  @IsUUID()
  jobTitleId?: string;

  @ApiPropertyOptional({
    enum: [...EMPLOYMENT_STATUSES],
    enumName: EMPLOYMENT_STATUS_ENUM_NAME,
    description:
      'Setting `terminated` stamps terminatedOn; moving off it clears the date.',
  })
  @IsOptional()
  @IsIn([...EMPLOYMENT_STATUSES])
  employmentStatus?: EmploymentStatus;

  @ApiPropertyOptional({
    type: 'array',
    items: { type: 'string', format: 'uuid' },
    description:
      'Replaces every current grant. Changing this revokes the member’s ' +
      'live sessions, forcing a re-login so their token carries the new roles.',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  roleIds?: string[];
}

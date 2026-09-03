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

import { normalisePhone, PHONE_MESSAGE, PHONE_REGEX } from '../../auth/phone';

const EMPLOYMENT_STATUSES = ['active', 'on_leave', 'terminated'] as const;
const GENDERS = ['male', 'female'] as const;

export class CreateStaffDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  lastName!: string;

  @Transform(({ value }) =>
    typeof value === 'string' ? normalisePhone(value) : value,
  )
  @IsString()
  @Matches(PHONE_REGEX, { message: PHONE_MESSAGE })
  phone!: string;

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsIn([...GENDERS])
  gender?: (typeof GENDERS)[number];

  @IsString()
  @IsNotEmpty()
  @MaxLength(24)
  staffCode!: string;

  @IsUUID()
  primaryBranchId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  jobTitle!: string;

  @IsDateString()
  hiredOn!: string;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  roleIds?: string[];
}

export class UpdateStaffDto {
  @IsOptional()
  @IsString()
  @MaxLength(80)
  firstName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  lastName?: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsIn([...GENDERS])
  gender?: (typeof GENDERS)[number];

  @IsOptional()
  @IsUUID()
  primaryBranchId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  jobTitle?: string;

  @IsOptional()
  @IsIn([...EMPLOYMENT_STATUSES])
  employmentStatus?: (typeof EMPLOYMENT_STATUSES)[number];

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  roleIds?: string[];
}

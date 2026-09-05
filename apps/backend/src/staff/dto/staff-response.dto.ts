import { ApiProperty } from '@nestjs/swagger';

import {
  DATA_SCOPE_ENUM_NAME,
  DATA_SCOPES,
  EMPLOYMENT_STATUS_ENUM_NAME,
  EMPLOYMENT_STATUSES,
  GENDER_ENUM_NAME,
  GENDERS,
  ACCOUNT_STATUS_ENUM_NAME,
  ACCOUNT_STATUSES,
  type DataScope,
  type EmploymentStatus,
  type Gender,
  type AccountStatus,
} from '../../common/enums';

export class StaffRoleRefDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, example: 'Receptionist' })
  name!: string;
}

export class StaffListItemDto {
  @ApiProperty({
    type: String,
    format: 'uuid',
    description:
      'The identifier everywhere: staff is keyed by the person id, so this is ' +
      'what /staff/{id} takes.',
  })
  personId!: string;

  @ApiProperty({ type: String, example: 'STF-000001' })
  staffCode!: string;

  @ApiProperty({ type: String, example: 'Receptionist' })
  jobTitle!: string;

  @ApiProperty({
    type: String,
    format: 'uuid',
    description: 'Send this back on update, not the label.',
  })
  jobTitleId!: string;

  @ApiProperty({
    type: Boolean,
    description:
      'Whether they can sign in. False means no account row exists at all — ' +
      'an employee on the roster with no way in, such as a cleaner.',
  })
  hasAccount!: boolean;

  @ApiProperty({
    enum: [...EMPLOYMENT_STATUSES],
    enumName: EMPLOYMENT_STATUS_ENUM_NAME,
  })
  employmentStatus!: EmploymentStatus;

  @ApiProperty({
    enum: [...DATA_SCOPES],
    enumName: DATA_SCOPE_ENUM_NAME,
    description: 'Whether their queries are confined to branchId.',
  })
  dataScope!: DataScope;

  @ApiProperty({ type: String, format: 'date', example: '2026-01-15' })
  hiredOn!: string;

  @ApiProperty({ type: String })
  firstName!: string;

  @ApiProperty({ type: String })
  lastName!: string;

  @ApiProperty({ type: String, example: '0912345678' })
  phone!: string;

  @ApiProperty({
    enum: [...ACCOUNT_STATUSES],
    enumName: ACCOUNT_STATUS_ENUM_NAME,
    nullable: true,
    description:
      'The state of their login, or null when they have none (hasAccount ' +
      'false). Independent of employmentStatus: an employee on leave may keep ' +
      'an active login, and a working one may have it disabled.',
  })
  status!: AccountStatus | null;

  @ApiProperty({ type: String, format: 'uuid' })
  branchId!: string;

  @ApiProperty({ type: String, example: 'Main Branch' })
  branchName!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: [StaffRoleRefDto] })
  roles!: StaffRoleRefDto[];
}

/** GET /staff/{id} — the list row plus the columns only the detail selects. */
export class StaffDetailDto extends StaffListItemDto {
  @ApiProperty({ type: String, format: 'date', nullable: true })
  terminatedOn!: string | null;

  @ApiProperty({ type: String, format: 'date', nullable: true })
  dateOfBirth!: string | null;

  @ApiProperty({
    enum: [...GENDERS],
    enumName: GENDER_ENUM_NAME,
    nullable: true,
  })
  gender!: Gender | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  lastLoginAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;
}

/**
 * POST /staff only. Deliberately narrower than StaffDetailDto: create returns
 * the raw staff insert row, so there are no names, no phone, no branchName and
 * no roles. Refetch GET /staff/{personId} for the full record.
 */
export class StaffProfileDto {
  @ApiProperty({ type: String, format: 'uuid' })
  personId!: string;

  @ApiProperty({ type: String, example: 'STF-000003' })
  staffCode!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  primaryBranchId!: string;

  @ApiProperty({ type: String, example: 'Receptionist' })
  jobTitle!: string;

  @ApiProperty({
    type: String,
    format: 'uuid',
    description: 'Send this back on update, not the label.',
  })
  jobTitleId!: string;

  @ApiProperty({
    type: Boolean,
    description:
      'Whether they can sign in. False means no account row exists at all — ' +
      'an employee on the roster with no way in, such as a cleaner.',
  })
  hasAccount!: boolean;

  @ApiProperty({
    enum: [...EMPLOYMENT_STATUSES],
    enumName: EMPLOYMENT_STATUS_ENUM_NAME,
  })
  employmentStatus!: EmploymentStatus;

  @ApiProperty({ enum: [...DATA_SCOPES], enumName: DATA_SCOPE_ENUM_NAME })
  dataScope!: DataScope;

  @ApiProperty({ type: String, format: 'date' })
  hiredOn!: string;

  @ApiProperty({ type: String, format: 'date', nullable: true })
  terminatedOn!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;
}

/** DELETE /staff/{id} returns only the id of the soft-deleted person. */
export class StaffDeletedDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;
}

import { ApiProperty } from '@nestjs/swagger';

import {
  EMPLOYMENT_STATUS_ENUM_NAME,
  EMPLOYMENT_STATUSES,
  GENDER_ENUM_NAME,
  GENDERS,
  USER_STATUS_ENUM_NAME,
  USER_STATUSES,
  type EmploymentStatus,
  type Gender,
  type UserStatus,
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
      'The identifier everywhere: staff_profiles is keyed by the user id, so ' +
      'this is what /staff/{id} takes.',
  })
  userId!: string;

  @ApiProperty({ type: String, example: 'STF-000001' })
  staffCode!: string;

  @ApiProperty({ type: String, example: 'Receptionist' })
  jobTitle!: string;

  @ApiProperty({
    enum: [...EMPLOYMENT_STATUSES],
    enumName: EMPLOYMENT_STATUS_ENUM_NAME,
  })
  employmentStatus!: EmploymentStatus;

  @ApiProperty({ type: String, format: 'date', example: '2026-01-15' })
  hiredOn!: string;

  @ApiProperty({ type: String })
  firstName!: string;

  @ApiProperty({ type: String })
  lastName!: string;

  @ApiProperty({ type: String, example: '0912345678' })
  phone!: string;

  @ApiProperty({
    enum: [...USER_STATUSES],
    enumName: USER_STATUS_ENUM_NAME,
    description: 'Account state, independent of employmentStatus.',
  })
  status!: UserStatus;

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
 * the raw staff_profiles insert row, so there are no names, no phone, no
 * branchName and no roles. Refetch GET /staff/{userId} for the full record.
 */
export class StaffProfileDto {
  @ApiProperty({ type: String, format: 'uuid' })
  userId!: string;

  @ApiProperty({ type: String, example: 'STF-000003' })
  staffCode!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  primaryBranchId!: string;

  @ApiProperty({ type: String, example: 'Receptionist' })
  jobTitle!: string;

  @ApiProperty({
    enum: [...EMPLOYMENT_STATUSES],
    enumName: EMPLOYMENT_STATUS_ENUM_NAME,
  })
  employmentStatus!: EmploymentStatus;

  @ApiProperty({ type: String, format: 'date' })
  hiredOn!: string;

  @ApiProperty({ type: String, format: 'date', nullable: true })
  terminatedOn!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;
}

/** DELETE /staff/{id} returns only the id of the soft-deleted user. */
export class StaffDeletedDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;
}

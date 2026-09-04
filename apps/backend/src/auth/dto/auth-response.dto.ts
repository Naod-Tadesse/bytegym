import { ApiProperty } from '@nestjs/swagger';

import {
  DATA_SCOPE_ENUM_NAME,
  DATA_SCOPES,
  EMPLOYMENT_STATUS_ENUM_NAME,
  EMPLOYMENT_STATUSES,
  USER_STATUS_ENUM_NAME,
  USER_STATUSES,
  type DataScope,
  type EmploymentStatus,
  type UserStatus,
} from '../../common/enums';

export class TokenPairDto {
  @ApiProperty({
    type: String,
    description: 'Short-lived. Send as `Authorization: Bearer <token>`.',
  })
  accessToken!: string;

  @ApiProperty({
    type: String,
    description:
      'Single-use: every refresh rotates it. Replaying a spent token is ' +
      'treated as theft and revokes every session for that user.',
  })
  refreshToken!: string;
}

/** The shape of GET /auth/me. */
export class CurrentUserDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String })
  firstName!: string;

  @ApiProperty({ type: String })
  lastName!: string;

  @ApiProperty({ type: String, example: '0911000000' })
  phone!: string;

  @ApiProperty({ enum: [...USER_STATUSES], enumName: USER_STATUS_ENUM_NAME })
  status!: UserStatus;

  @ApiProperty({ type: String, example: 'STF-000001' })
  staffCode!: string;

  @ApiProperty({ type: String, example: 'Owner' })
  jobTitle!: string;

  @ApiProperty({
    enum: [...EMPLOYMENT_STATUSES],
    enumName: EMPLOYMENT_STATUS_ENUM_NAME,
  })
  employmentStatus!: EmploymentStatus;

  @ApiProperty({
    enum: [...DATA_SCOPES],
    enumName: DATA_SCOPE_ENUM_NAME,
    description:
      'At `branch` the UI hides anything cross-branch — the Branches page, ' +
      'and the Branch column on the staff table.',
  })
  dataScope!: DataScope;

  @ApiProperty({ type: String, format: 'uuid' })
  branchId!: string;

  @ApiProperty({ type: String, example: 'Main Branch' })
  branchName!: string;

  @ApiProperty({
    type: [String],
    example: ['Owner'],
    description: 'Role names, not ids.',
  })
  roles!: string[];

  @ApiProperty({
    type: [String],
    example: ['branch.list', 'staff.list'],
    description:
      'Read live from the database on every call rather than echoed from the ' +
      'token, so a revoked permission disappears before the token expires.',
  })
  permissions!: string[];
}

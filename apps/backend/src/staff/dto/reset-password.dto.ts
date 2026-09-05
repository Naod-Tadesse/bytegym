import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

import {
  ACCOUNT_STATUS_ENUM_NAME,
  ACCOUNT_STATUSES,
  DATA_SCOPE_ENUM_NAME,
  DATA_SCOPES,
  type AccountStatus,
  type DataScope,
} from '../../common/enums';

/**
 * An administrative reset — deliberately no `currentPassword`. The caller
 * proves their right through `staff.resetPassword`, not through knowing the
 * locked-out person's password.
 *
 * There is no `confirmPassword` here: matching the two boxes is a typo guard
 * for the person typing, so the form checks it and the API never sees it.
 */
export class ResetStaffPasswordDto {
  @ApiProperty({ type: String, minLength: 8 })
  @IsString()
  @MinLength(8)
  newPassword!: string;
}

/**
 * Granting access for the FIRST time, which is a different act from resetting
 * a forgotten password — hence a different endpoint and a different permission.
 * Only a job title with `canHaveAccount` will accept one.
 */
export class GrantStaffAccessDto {
  @ApiProperty({
    type: String,
    minLength: 8,
    description: 'The password they will sign in with.',
  })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiPropertyOptional({
    type: [String],
    format: 'uuid',
    description:
      'Granted with the account, in the same transaction. Omit or send an ' +
      'empty array for someone who should be able to sign in but do nothing ' +
      'yet — otherwise this is where they get their roles, since an account ' +
      'with none is exactly that.',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  roleIds?: string[];
}

/**
 * What a signed-in staff member may reach. Both fields are baked into the
 * access token, so changing either revokes their staff sessions.
 */
export class SetStaffAuthorizationDto {
  @ApiPropertyOptional({
    type: [String],
    format: 'uuid',
    description:
      'Replaces every grant — send the complete desired set, since anything ' +
      'omitted is revoked. Omit the field entirely to leave roles untouched.',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  roleIds?: string[];

  @ApiPropertyOptional({
    enum: [...DATA_SCOPES],
    enumName: DATA_SCOPE_ENUM_NAME,
    description:
      '`branch` confines every query to their primaryBranchId; `all` removes ' +
      'the filter. Only a caller who already has `all` may grant it.',
  })
  @IsOptional()
  @IsIn([...DATA_SCOPES])
  dataScope?: DataScope;
}

/**
 * Switching a login off and on without destroying it — the reversible middle
 * ground between doing nothing and revoking, which deletes the credential.
 */
export class SetAccountStatusDto {
  @ApiProperty({
    enum: [...ACCOUNT_STATUSES],
    enumName: ACCOUNT_STATUS_ENUM_NAME,
    description:
      '`disabled` refuses sign-in and revokes their live sessions but keeps ' +
      'the password, so `active` hands back the credential they already know.',
  })
  @IsIn([...ACCOUNT_STATUSES])
  status!: AccountStatus;
}

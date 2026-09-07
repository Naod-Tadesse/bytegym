import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

import { normalisePhone, PHONE_MESSAGE, PHONE_REGEX } from '../../auth/phone';
import { GENDER_ENUM_NAME, GENDERS, type Gender } from '../../common/enums';

/** Shared by both DTOs — a `+251…` paste normalises to local form. */
const PHONE_DESCRIPTION =
  'Ethiopian mobile in local form. `+251912345678` and `251912345678` are ' +
  'also accepted; both are normalised to `0912345678` before validation.';

export class CreateMemberDto {
  @ApiProperty({ type: String, maxLength: 80, example: 'Selam' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  firstName!: string;

  @ApiProperty({ type: String, maxLength: 80, example: 'Bekele' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  lastName!: string;

  @ApiProperty({
    type: String,
    example: '0912345678',
    pattern: PHONE_REGEX.source,
    description:
      `${PHONE_DESCRIPTION} Must not already belong to another person — ` +
      'registering someone who is already staff 409s today.',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? normalisePhone(value) : value,
  )
  @IsString()
  @Matches(PHONE_REGEX, { message: PHONE_MESSAGE })
  phone!: string;

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

  // memberCode is deliberately absent — the server draws it from a sequence
  // (`MBR00001`, `MBR00002`, …). Anything sent here is stripped by whitelist.

  @ApiProperty({
    type: String,
    format: 'uuid',
    description:
      'Their home gym. A branch-scoped caller may only name their own branch.',
  })
  @IsUUID()
  branchId!: string;

  @ApiPropertyOptional({
    type: String,
    maxLength: 120,
    example: 'Almaz Bekele',
  })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  emergencyContactName?: string;

  @ApiPropertyOptional({
    type: String,
    maxLength: 30,
    example: '0116000000',
    // Deliberately looser than the member's own phone: next of kin may be
    // reachable on a landline, and this number is never signed in with.
    description: 'Free-form contact number — no format is enforced.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  emergencyContactPhone?: string;
}

/**
 * Phone and member code are immutable — deliberately absent here, as on staff.
 *
 * Hand-written rather than `PartialType(CreateMemberDto)`: a mapped type
 * reflects as `Object`, which Swagger cannot see and ValidationPipe skips
 * entirely, silently disabling validation on the whole body.
 */
export class UpdateMemberDto {
  @ApiPropertyOptional({ type: String, maxLength: 80 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  firstName?: string;

  @ApiPropertyOptional({ type: String, maxLength: 80 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
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

  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    description:
      'Moves them to another branch. A branch-scoped caller may only name ' +
      'their own branch.',
  })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({ type: String, maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  emergencyContactName?: string;

  @ApiPropertyOptional({ type: String, maxLength: 30 })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  emergencyContactPhone?: string;
}

/**
 * Its own endpoint rather than a field on UpdateMemberDto: barring someone from
 * the premises is a decision, not an edit, and PATCH /:id sending every field
 * back would flip it by accident.
 */
export class SetMemberSuspensionDto {
  @ApiProperty({
    type: Boolean,
    description:
      'True bars them from the premises. Independent of whether they have ' +
      'paid — an expired membership is derived, this is deliberate.',
  })
  @IsBoolean()
  isSuspended!: boolean;
}

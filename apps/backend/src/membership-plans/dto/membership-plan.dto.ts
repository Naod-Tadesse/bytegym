import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

/**
 * Money arrives as a decimal **string** and is stored as one — `numeric(12,2)`
 * end to end, never parsed to a float. Two decimal places at most: the column
 * would round a third silently, so it is rejected instead.
 *
 * `\d{1,10}` before the point is what precision 12 scale 2 leaves room for; a
 * longer number would overflow the column and surface as a 500 rather than a
 * validation error. That bound is expressed as `maxLength` rather than in the
 * pattern so the pattern stays the one the frontend mirrors.
 */
const PRICE_PATTERN = /^\d+(\.\d{1,2})?$/;
const PRICE_MAX_LENGTH = 13; // 10 digits + '.' + 2 decimals

export class CreateMembershipPlanDto {
  @ApiProperty({ type: String, maxLength: 120, example: 'Monthly' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({
    type: String,
    maxLength: 500,
    example: 'Full gym access for 30 days.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({
    type: Number,
    minimum: 1,
    example: 30,
    description:
      'How many days the membership covers. The end date is inclusive, so a ' +
      '30-day plan starting today ends on day 29.',
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  durationDays!: number;

  @ApiProperty({
    type: String,
    pattern: PRICE_PATTERN.source,
    maxLength: PRICE_MAX_LENGTH,
    example: '1500.00',
    description:
      'A decimal string, not a number — `"1500"` or `"1500.00"`. Stored as ' +
      'numeric(12,2) and returned as a string, so no float rounding is ever ' +
      'possible.',
  })
  @IsString()
  @MaxLength(PRICE_MAX_LENGTH)
  @Matches(PRICE_PATTERN, {
    message: 'price must be a number like 1500 or 1500.00',
  })
  price!: string;

  @ApiPropertyOptional({
    type: String,
    pattern: PRICE_PATTERN.source,
    maxLength: PRICE_MAX_LENGTH,
    default: '0',
    example: '900.00',
    description:
      'The one-off joining fee, charged **only the first time a member ever ' +
      'buys anything** — someone who lapsed and comes back pays `0`. ' +
      'Defaults to `"0"`, so a plan that omits it costs exactly its price.\n\n' +
      'Snapshotted onto the membership at sale and added to `price` to give ' +
      'the amount due, which is what `POST /memberships` charges. It is not ' +
      'folded into `price` on purpose: registration income has to stay ' +
      'reportable on its own, and `price` has to keep meaning what the plan ' +
      'cost.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(PRICE_MAX_LENGTH)
  @Matches(PRICE_PATTERN, {
    message: 'registrationFee must be a number like 900 or 900.00',
  })
  registrationFee?: string;

  @ApiPropertyOptional({
    type: Boolean,
    default: true,
    description:
      'Defaults to true. Set false to create a plan that is not yet sellable.',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateMembershipPlanDto {
  @ApiPropertyOptional({ type: String, maxLength: 120 })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ type: String, maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({ type: Number, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  durationDays?: number;

  @ApiPropertyOptional({
    type: String,
    pattern: PRICE_PATTERN.source,
    maxLength: PRICE_MAX_LENGTH,
    example: '1500.00',
    description:
      'Correcting a typo, not raising the price. To raise a price, create a ' +
      'new plan and retire this one — see the endpoint description.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(PRICE_MAX_LENGTH)
  @Matches(PRICE_PATTERN, {
    message: 'price must be a number like 1500 or 1500.00',
  })
  price?: string;

  @ApiPropertyOptional({
    type: String,
    pattern: PRICE_PATTERN.source,
    maxLength: PRICE_MAX_LENGTH,
    example: '900.00',
    description:
      'The one-off joining fee. Changing it moves what NEW first-time sales ' +
      'charge; memberships already sold snapshotted their own copy and are ' +
      'untouched. Set `"0"` for a plan with no joining fee.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(PRICE_MAX_LENGTH)
  @Matches(PRICE_PATTERN, {
    message: 'registrationFee must be a number like 900 or 900.00',
  })
  registrationFee?: string;

  @ApiPropertyOptional({
    type: Boolean,
    description:
      'Set false to retire the plan. It stops being sellable; memberships ' +
      'already sold on it are untouched.',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

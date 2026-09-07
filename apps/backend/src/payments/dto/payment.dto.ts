import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

import {
  PAYMENT_METHOD_ENUM_NAME,
  PAYMENT_METHODS,
  type PaymentMethod,
} from '../../common/enums';
import { DATE_ONLY_PATTERN } from '../../common/gym-day';
import { PaginationDto } from '../../common/pagination.dto';

/**
 * Money arrives as a decimal **string** and is stored as one — `numeric(12,2)`
 * end to end, never parsed to a float. Same shape as a plan's price, with one
 * addition: the negative lookahead rejects `0`, `0.00` and `00`. A zero
 * payment is not money changing hands, and it would sit in the ledger looking
 * like a receipt.
 *
 * `maxLength` rather than a bound inside the pattern, so the pattern stays the
 * one the frontend mirrors. 13 is what precision 12 scale 2 leaves room for —
 * a longer number overflows the column and surfaces as a 500 rather than a 400.
 */
const AMOUNT_PATTERN = /^(?!0+(\.0{1,2})?$)\d+(\.\d{1,2})?$/;
const AMOUNT_MAX_LENGTH = 13; // 10 digits + '.' + 2 decimals
const AMOUNT_MESSAGE =
  'amount must be a positive number like 800 or 800.50, at most 2 decimals';

export class RecordPaymentDto {
  @ApiProperty({
    type: String,
    format: 'uuid',
    description:
      'The payer’s person id. A member at another branch 404s rather than ' +
      '403s, so this cannot be used to discover ids.',
  })
  @IsUUID()
  memberId!: string;

  @ApiProperty({
    type: String,
    format: 'uuid',
    description:
      'The membership this settles. **Required — a payment is only ever for ' +
      'a membership.** The joining fee is not a payment of its own any more; ' +
      'it is `registrationFee` on the membership, part of its `amountDue`.\n\n' +
      'This endpoint is the **instalment** path: many payments against one ' +
      'membership is the normal case — 800 now, the rest on Friday — which ' +
      'is why it carries its own `amount`. To take the full amount at the ' +
      'moment of sale, send `payment` to `POST /memberships` instead and the ' +
      'server prices it.\n\nA membership belonging to a different member is ' +
      'a 400, and one at another branch 404s.',
  })
  @IsUUID()
  membershipId!: string;

  @ApiProperty({
    type: String,
    pattern: AMOUNT_PATTERN.source,
    maxLength: AMOUNT_MAX_LENGTH,
    example: '800.00',
    description:
      'A decimal string, not a number — `"800"` or `"800.00"`. Stored as ' +
      'numeric(12,2) and returned as a string, so no float rounding is ever ' +
      'possible: 0.10 and 0.20 sum to exactly 0.30.\n\n' +
      'Must be greater than zero. Nothing caps it at the outstanding balance ' +
      '— overpaying is a real thing that happens at a front desk, and the ' +
      'balance simply goes negative.',
  })
  @IsString()
  @MaxLength(AMOUNT_MAX_LENGTH)
  @Matches(AMOUNT_PATTERN, { message: AMOUNT_MESSAGE })
  amount!: string;

  @ApiProperty({
    enum: [...PAYMENT_METHODS],
    enumName: PAYMENT_METHOD_ENUM_NAME,
    description: 'How the money arrived.',
  })
  @IsIn([...PAYMENT_METHODS])
  method!: PaymentMethod;

  @ApiPropertyOptional({
    type: String,
    maxLength: 80,
    example: 'TB2409071234',
    description:
      'The transaction id on the receipt — a telebirr reference, a bank slip ' +
      'number. Free text and not verified against anything.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  reference?: string;

  @ApiPropertyOptional({ type: String, maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  note?: string;

  // branchId and receivedByStaffId are deliberately absent. The branch comes
  // from the member's home gym and the cashier from the access token; anything
  // sent for either is stripped by the whitelisting ValidationPipe.
}

export class VoidPaymentDto {
  @ApiProperty({
    type: String,
    maxLength: 255,
    example: 'Entered twice by mistake',
    description:
      'Why the payment is being reversed. Required, and shown beside the row ' +
      'for good: a voided payment stays in the list, and a reversal with no ' +
      'reason is what an audit cannot explain.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  reason!: string;
}

/**
 * `search` is inherited from PaginationDto and ignored here — a payment’s only
 * text is a free-form reference, and matching on it would quietly return rows
 * whose member does not match instead.
 */
export class PaymentQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    description: 'One member’s payment history.',
  })
  @IsOptional()
  @IsUUID()
  memberId?: string;

  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    description:
      'Everything paid against one membership. This is the filter behind the ' +
      'balance shown on a membership row.',
  })
  @IsOptional()
  @IsUUID()
  membershipId?: string;

  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    description:
      'One branch’s takings. A branch-scoped caller naming another branch ' +
      'gets an empty page rather than an error — their own scope still ' +
      'applies on top of this.',
  })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({
    type: String,
    format: 'date',
    pattern: DATE_ONLY_PATTERN.source,
    example: '2026-09-07',
    description:
      'Earliest gym day to include, **inclusive** and date only. The day is ' +
      'the gym’s (Africa/Addis_Ababa), not UTC — a payment taken at 01:00 ' +
      'belongs to the shift that took it.',
  })
  @IsOptional()
  // Both, and neither is redundant: the pattern rejects a full timestamp and
  // the compact `20260907`, which IsDateString accepts; `strict` rejects
  // `2026-02-30`, which the pattern cannot see. Either gap reaches Postgres as
  // a 500 instead of a 400.
  @Matches(DATE_ONLY_PATTERN, {
    message: 'from must be a date in YYYY-MM-DD form',
  })
  @IsDateString({ strict: true })
  from?: string;

  @ApiPropertyOptional({
    type: String,
    format: 'date',
    pattern: DATE_ONLY_PATTERN.source,
    example: '2026-09-07',
    description:
      'Latest gym day to include, **inclusive**. Pass the same value as ' +
      '`from` for a single day’s takings.',
  })
  @IsOptional()
  @Matches(DATE_ONLY_PATTERN, {
    message: 'to must be a date in YYYY-MM-DD form',
  })
  @IsDateString({ strict: true })
  to?: string;
}

import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

import {
  PAYMENT_METHOD_ENUM_NAME,
  PAYMENT_METHODS,
  type PaymentMethod,
} from '../../common/enums';
import { DATE_ONLY_PATTERN } from '../../common/gym-day';
import { PaginationDto } from '../../common/pagination.dto';

/**
 * The money half of a sale.
 *
 * **There is deliberately no `amount`.** The server charges the full amount
 * due — `price + registrationFee` on the membership it just wrote — which is
 * what "the amount is displayed automatically, no manual amount" means, and it
 * also means a client cannot under-charge by editing a number on the way in.
 * Paying in instalments is `POST /payments`, where a partial figure is the
 * point.
 *
 * A real class rather than an inline shape: a mapped type reflects as `Object`,
 * which Swagger cannot see **and ValidationPipe skips entirely** — silently
 * disabling validation on the one part of the body that names money.
 */
export class SellMembershipPaymentDto {
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
}

export class SellMembershipDto {
  @ApiProperty({
    type: String,
    format: 'uuid',
    description:
      'The member’s person id. A member at another branch 404s rather than ' +
      '403s, so this cannot be used to discover ids.',
  })
  @IsUUID()
  memberId!: string;

  @ApiProperty({
    type: String,
    format: 'uuid',
    description:
      'The plan being sold. A retired plan (`isActive: false`) is refused ' +
      'with a 400 — the price and duration come from this row.',
  })
  @IsUUID()
  planId!: string;

  @ApiPropertyOptional({
    type: String,
    format: 'date',
    pattern: DATE_ONLY_PATTERN.source,
    example: '2026-09-07',
    description:
      'First day of cover, **date only** — `2026-09-07`, not a timestamp. ' +
      'Defaults to today in the gym’s timezone.\n\n' +
      'Set it to the day after an existing membership ends to renew early: ' +
      'both rows stay real and cover is unbroken. Any date the member is ' +
      'already covered for is refused with a 409.',
  })
  @IsOptional()
  // Both, and neither is redundant: the pattern rejects a full timestamp and
  // the compact `20260907`, which IsDateString accepts and the end-date maths
  // cannot read; `strict` rejects `2026-02-30`, which the pattern cannot see.
  // Either gap reaches Postgres as a 500 instead of a 400.
  @Matches(DATE_ONLY_PATTERN, {
    message: 'startsOn must be a date in YYYY-MM-DD form',
  })
  @IsDateString({ strict: true })
  startsOn?: string;

  @ApiPropertyOptional({
    type: Boolean,
    default: false,
    description:
      'A comped period — staff, a promotion. The row still snapshots the ' +
      'plan’s price and joining fee, so reports can tell what was given away, ' +
      'but the balance is `0.00` and nothing is owed.\n\n' +
      'Sending a `payment` alongside this is a **400**: nothing is owed, so ' +
      'there is nothing to take.',
  })
  @IsOptional()
  @IsBoolean()
  isComplimentary?: boolean;

  @ApiPropertyOptional({
    type: SellMembershipPaymentDto,
    description:
      'Takes the money in the same transaction as the sale. The amount is ' +
      'the **full amount due** — `price + registrationFee` — computed by the ' +
      'server; there is no amount field.\n\n' +
      'Omit it to sell with nothing paid, which is how an instalment starts: ' +
      'the membership is created with the full `balance` outstanding and the ' +
      'rest is settled through `POST /payments`.\n\n' +
      'Refused with a 400 when `isComplimentary` is true, or when the plan ' +
      'and its joining fee come to nothing.',
  })
  @IsOptional()
  // Both, and neither is redundant: without @Type the nested object stays a
  // plain object and @ValidateNested has no class to validate against, so
  // every rule inside would be skipped.
  @ValidateNested()
  @Type(() => SellMembershipPaymentDto)
  payment?: SellMembershipPaymentDto;
}

/**
 * `search` is inherited from PaginationDto but is not used here — a membership
 * has no text worth matching. The list is filtered by member instead.
 */
export class MembershipQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    description:
      'Restrict to one member’s history. Omit to list every membership the ' +
      'caller’s branch scope allows.',
  })
  @IsOptional()
  @IsUUID()
  memberId?: string;
}

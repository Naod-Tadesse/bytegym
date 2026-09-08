import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

import {
  SMS_KIND_ENUM_NAME,
  SMS_KINDS,
  SMS_STATUS_ENUM_NAME,
  SMS_STATUSES,
  type SmsKind,
  type SmsStatus,
} from '../../common/enums';
import { DATE_ONLY_PATTERN } from '../../common/gym-day';
import { PaginationDto } from '../../common/pagination.dto';
import { normalisePhone, PHONE_MESSAGE, PHONE_REGEX } from '../../auth/phone';

/**
 * A single SMS is 160 GSM-7 characters; longer text is split and billed per
 * part. Four parts is a generous ceiling that still stops somebody pasting an
 * essay and being surprised by the invoice.
 */
const MAX_MESSAGE_LENGTH = 640;

export class SendSmsDto {
  @ApiProperty({
    type: String,
    pattern: PHONE_REGEX.source,
    example: '0912345678',
    description:
      'Local Ethiopian form. A pasted `+251…` is normalised before ' +
      'validation. The country code is added at the provider boundary, not ' +
      'stored here.',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? normalisePhone(value) : value,
  )
  @Matches(PHONE_REGEX, { message: PHONE_MESSAGE })
  phone!: string;

  @ApiProperty({
    type: String,
    maxLength: MAX_MESSAGE_LENGTH,
    example: 'Happy new year from all of us at the gym!',
    description:
      'The text, exactly as it will be sent. `{{name}}` is substituted when ' +
      'the number belongs to a member, and left alone when it does not.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_MESSAGE_LENGTH)
  message!: string;
}

export class BroadcastDto {
  @ApiProperty({
    enum: ['all', 'plan'],
    example: 'all',
    description:
      '`all` — every member at the caller’s branch. `plan` — only those whose ' +
      'membership **covers today** and is on `planId`; a lapsed member on ' +
      'that plan is not included, because they are not on it any more.',
  })
  @IsIn(['all', 'plan'])
  audience!: 'all' | 'plan';

  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    description: 'Required when `audience` is `plan`, ignored otherwise.',
  })
  @IsOptional()
  @IsUUID()
  planId?: string;

  @ApiProperty({
    type: String,
    maxLength: MAX_MESSAGE_LENGTH,
    example: 'Happy new year from all of us at the gym!',
    description:
      'The text. `{{name}}` is replaced with each member’s first name, so one ' +
      'message can still read as addressed to them.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_MESSAGE_LENGTH)
  message!: string;
}

export class UpdateSmsSettingsDto {
  @ApiPropertyOptional({
    type: Boolean,
    description:
      'Turn the daily expiry reminder on or off. Off by default — reminders ' +
      'cost money per member per day and reach real phones.',
  })
  @IsOptional()
  @IsBoolean()
  reminderEnabled?: boolean;

  @ApiPropertyOptional({
    type: Number,
    minimum: 1,
    maximum: 365,
    example: 7,
    description:
      'How many days before expiry the reminders start. From that day the ' +
      'member is texted **every day** until their membership lapses, so this ' +
      'number is also how many messages each member costs: seven days is ' +
      'seven messages.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(365)
  reminderDaysBefore?: number;

  @ApiPropertyOptional({
    type: Number,
    minimum: 0,
    maximum: 23,
    example: 9,
    description:
      'The hour of the **gym’s** day the reminders go out, 0–23. The job ' +
      'ticks hourly and sends at the first tick at or after this hour, so a ' +
      'restart at the wrong moment delays the run rather than losing the day.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  reminderHour?: number;

  @ApiPropertyOptional({
    type: String,
    maxLength: MAX_MESSAGE_LENGTH,
    description:
      'The reminder text. `{{name}}`, `{{days}}` and `{{date}}` are ' +
      'substituted. An unknown placeholder is left as written rather than ' +
      'blanked — "Hi {{naem}}" is an obvious typo, "Hi ," looks like a fault.',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_MESSAGE_LENGTH)
  reminderTemplate?: string;
}

export class SmsQueryDto extends PaginationDto {
  /** `search` matches the number or the body — the two things anyone recalls. */

  @ApiPropertyOptional({
    enum: [...SMS_KINDS],
    enumName: SMS_KIND_ENUM_NAME,
    description: 'Typed by hand, part of a bulk send, or the automatic nudge.',
  })
  @IsOptional()
  @IsIn([...SMS_KINDS])
  kind?: SmsKind;

  @ApiPropertyOptional({
    enum: [...SMS_STATUSES],
    enumName: SMS_STATUS_ENUM_NAME,
    description:
      '`held` is not a failure: the test allowlist stopped it, so nothing was ' +
      'attempted and nothing was charged.',
  })
  @IsOptional()
  @IsIn([...SMS_STATUSES])
  status?: SmsStatus;

  @ApiPropertyOptional({ type: String, format: 'uuid' })
  @IsOptional()
  @IsUUID()
  memberId?: string;

  @ApiPropertyOptional({
    type: String,
    format: 'date',
    pattern: DATE_ONLY_PATTERN.source,
    example: '2026-09-01',
    description: 'Earliest gym day, inclusive.',
  })
  @IsOptional()
  @Matches(DATE_ONLY_PATTERN, {
    message: 'from must be a date in YYYY-MM-DD form',
  })
  @IsDateString({ strict: true })
  from?: string;

  @ApiPropertyOptional({
    type: String,
    format: 'date',
    pattern: DATE_ONLY_PATTERN.source,
    example: '2026-09-30',
    description: 'Latest gym day, inclusive.',
  })
  @IsOptional()
  @Matches(DATE_ONLY_PATTERN, {
    message: 'to must be a date in YYYY-MM-DD form',
  })
  @IsDateString({ strict: true })
  to?: string;
}

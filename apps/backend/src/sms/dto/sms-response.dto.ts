import { ApiProperty } from '@nestjs/swagger';

import {
  SMS_KIND_ENUM_NAME,
  SMS_KINDS,
  SMS_STATUS_ENUM_NAME,
  SMS_STATUSES,
  type SmsKind,
  type SmsStatus,
} from '../../common/enums';

/**
 * Mirrors what `SmsMessagesService` selects. Documentation only — nothing binds
 * this to the query, so the two change together.
 */
export class SmsMessageDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({
    type: String,
    example: '0912345678',
    description: 'Local form, as stored. The provider’s `251…` is not kept.',
  })
  phone!: string;

  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    description:
      'Null when the number belongs to no member — a supplier, or somebody ' +
      'not signed up yet. Not an error, which is why the column is nullable.',
  })
  memberId!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'Kasimir Leach' })
  memberName!: string | null;

  @ApiProperty({
    type: String,
    description:
      'The text as it was actually sent, stored in full rather than as a ' +
      'template id — templates get edited, and “what exactly did you send” ' +
      'has to be answerable afterwards.',
  })
  body!: string;

  @ApiProperty({ enum: [...SMS_KINDS], enumName: SMS_KIND_ENUM_NAME })
  kind!: SmsKind;

  @ApiProperty({
    enum: [...SMS_STATUSES],
    enumName: SMS_STATUS_ENUM_NAME,
    description:
      '`sent` — the provider accepted it. `held` — the test allowlist stopped ' +
      'it, so nothing was attempted and nothing was charged. `failed` — it ' +
      'was attempted and refused. Held is deliberately not a kind of failed.',
  })
  status!: SmsStatus;

  @ApiProperty({ type: String, nullable: true })
  error!: string | null;

  @ApiProperty({
    type: String,
    format: 'date',
    example: '2026-09-08',
    description: 'The **gym’s** day it went out, not UTC’s.',
  })
  sentOn!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;
}

export class SmsSettingsDto {
  @ApiProperty({ type: Boolean })
  reminderEnabled!: boolean;

  @ApiProperty({
    type: Number,
    example: 7,
    description:
      'Reminders start this many days before expiry and repeat daily until ' +
      'the membership lapses — so this is also the number of messages each ' +
      'expiring member costs.',
  })
  reminderDaysBefore!: number;

  @ApiProperty({
    type: Number,
    example: 9,
    description:
      'The hour of the gym’s day they go out, 0–23. Africa/Addis_Ababa, not ' +
      'the server’s clock — the two are three hours apart.',
  })
  reminderHour!: number;

  @ApiProperty({
    type: String,
    description: '`{{name}}`, `{{days}}` and `{{date}}` are substituted.',
  })
  reminderTemplate!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;

  @ApiProperty({ type: String, format: 'uuid', nullable: true })
  updatedByStaffId!: string | null;
}

export class BroadcastResultDto {
  @ApiProperty({
    type: Number,
    example: 412,
    description:
      'How many members it went out to. Counted before sending — the messages ' +
      'themselves are still going when this is returned.',
  })
  recipients!: number;
}

export class SmsRecipientCountDto {
  @ApiProperty({ type: Number, example: 412 })
  recipients!: number;
}

export class ReminderRunDto {
  @ApiProperty({ type: Number, example: 12 })
  sent!: number;

  @ApiProperty({
    type: Number,
    example: 3,
    description: 'Already reminded today, so left alone. Not a failure.',
  })
  skipped!: number;

  @ApiProperty({
    type: String,
    nullable: true,
    example: null,
    description: '`disabled` when reminders are switched off; null otherwise.',
  })
  reason!: string | null;
}

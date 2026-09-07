import { ApiProperty } from '@nestjs/swagger';

import {
  CHECKIN_REFUSAL_REASON_ENUM_NAME,
  CHECKIN_REFUSAL_REASONS,
  MEMBERSHIP_STATUS_ENUM_NAME,
  MEMBERSHIP_STATUSES,
  type CheckInRefusalReason,
  type MembershipStatus,
} from '../../common/enums';

/**
 * Mirrors what `CheckInsService` selects. Documentation only — nothing binds
 * this to the query, so the two change together. Nullable columns are
 * `nullable: true`, never optional: the key is always present, carrying null.
 */
export class CheckInDto {
  @ApiProperty({
    type: String,
    example: '12',
    description:
      'A **string**, not a number. The column is a `bigserial`, and a bigint ' +
      'past 2^53 does not survive a JSON number — so it is cast to text in ' +
      'the query and stays text all the way to the client. Do not parse it.',
  })
  id!: string;

  @ApiProperty({
    type: String,
    format: 'uuid',
    description: 'The member’s person id.',
  })
  memberId!: string;

  @ApiProperty({ type: String, example: 'Abebe Bekele' })
  memberName!: string;

  @ApiProperty({
    type: String,
    example: 'MBR00001',
    description: 'The member code, so the desk can read the row back to them.',
  })
  memberCode!: string;

  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    description:
      'The membership the visit fell under, or **null on an override** — ' +
      'null is what an override is: admitted with nothing covering the day. ' +
      'Pair it with `overrideByName` to tell an override from a data gap.',
  })
  membershipId!: string | null;

  @ApiProperty({
    type: String,
    format: 'uuid',
    description:
      'Where they trained — the **member’s** home gym, not the caller’s. The ' +
      'column branch scope filters on.',
  })
  branchId!: string;

  @ApiProperty({ type: String, example: 'Main Branch' })
  branchName!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'System Admin',
    description:
      'Who was on the desk. Null for a check-in recorded by something other ' +
      'than a person, or one whose recorder has since been removed.',
  })
  recordedByName!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'System Admin',
    description:
      'Who waved the member through with no membership covering the day, or ' +
      'null on an ordinary check-in. This is the column a manager scans at ' +
      'the end of a shift, so show it as a badge on the row.',
  })
  overrideByName!: string | null;

  @ApiProperty({
    type: String,
    format: 'date',
    example: '2026-09-07',
    description:
      'The gym day, **date only** and in the gym’s own timezone. Stored, not ' +
      'derived from `checkedInAt`: a 01:00 visit in Addis is the previous day ' +
      'in UTC, and one check-in per member per day is enforced on this column.',
  })
  checkedInOn!: string;

  @ApiProperty({
    type: String,
    format: 'date-time',
    description:
      'The instant of the scan. Compare it against now to tell a fresh ' +
      'check-in from a repeat scan that returned today’s existing row — ' +
      'though the HTTP status says so more plainly: 201 new, 200 existing.',
  })
  checkedInAt!: string;

  @ApiProperty({
    enum: [...MEMBERSHIP_STATUSES],
    enumName: MEMBERSHIP_STATUS_ENUM_NAME,
    description:
      'Where the member stands **today**, not on the day of this visit.\n\n' +
      'Deliberately not read off `membershipId`, which records what covered ' +
      'them at the time. Someone scanning today’s arrivals wants to see who ' +
      'is about to lapse, and the two answers only diverge in that direction.',
  })
  membershipStatus!: MembershipStatus;

  @ApiProperty({
    type: String,
    format: 'date',
    nullable: true,
    example: '2026-10-06',
    description:
      'The last day any of their memberships covers, or null if they have ' +
      'never had one. The desk counts down to it.',
  })
  expiresOn!: string | null;

  @ApiProperty({
    type: String,
    format: 'date',
    nullable: true,
    example: '2026-09-07',
    description:
      'The first day of the membership covering today, or null when nothing ' +
      'does.\n\nWith `expiresOn` it bounds the whole stretch the member has ' +
      'paid for and not yet used, which is what a "how far through" ' +
      'proportion has to measure. The current period alone would read an ' +
      'early renewal backwards — someone two-thirds through September who ' +
      'also holds October has six weeks left, not ten days.',
  })
  coverStartsOn!: string | null;
}

/**
 * The 403 body when the door is refused. `ErrorResponseDto` plus one field.
 *
 * Its own class rather than a description on the shared error schema, because
 * `reason` is the contract: **the UI branches on the code, never on the
 * prose.** Four refusals, four different next actions at the desk — fetch a
 * manager, sell a renewal, tell them to come back on the 1st, sign them up —
 * so the wording will keep being tuned and a UI matching on the sentence would
 * break silently the first time it is.
 */
export class CheckInRefusalDto {
  @ApiProperty({ example: 403 })
  statusCode!: number;

  @ApiProperty({
    type: String,
    example: 'This membership expired on 2026-08-31',
    description:
      'Human wording, safe to show as-is and safe to change. The expired and ' +
      'upcoming messages carry the date they refer to.',
  })
  message!: string;

  @ApiProperty({ example: 'Forbidden' })
  error!: string;

  @ApiProperty({
    enum: [...CHECKIN_REFUSAL_REASONS],
    enumName: CHECKIN_REFUSAL_REASON_ENUM_NAME,
    description:
      'Why, machine-readably.\n\n' +
      '- `suspended` — barred from the premises. **`checkin.override` does ' +
      'not lift this**; only the member record can.\n' +
      '- `expired` — has bought before, nothing covers today. Sell a renewal.\n' +
      '- `upcoming` — bought, but every period still lies ahead. They are ' +
      'early, not overdue; do not ask them for money.\n' +
      '- `none` — never bought one. Sign them up.',
  })
  reason!: CheckInRefusalReason;
}

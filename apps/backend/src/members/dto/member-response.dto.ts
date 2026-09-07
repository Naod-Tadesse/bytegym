import { ApiProperty } from '@nestjs/swagger';

import {
  GENDER_ENUM_NAME,
  GENDERS,
  MEMBERSHIP_STATUS_ENUM_NAME,
  MEMBERSHIP_STATUSES,
  type Gender,
  type MembershipStatus,
} from '../../common/enums';

/**
 * Documentation only — nothing binds this to what the service selects, so the
 * two change together. Nullable columns are `nullable: true`, never optional:
 * the key is always present, carrying null.
 */
export class MemberListItemDto {
  @ApiProperty({
    type: String,
    format: 'uuid',
    description:
      'The identifier everywhere: a member is keyed by the person id, so this ' +
      'is what /members/{id} takes.',
  })
  personId!: string;

  @ApiProperty({ type: String, example: 'MBR00001' })
  memberCode!: string;

  @ApiProperty({ type: String })
  firstName!: string;

  @ApiProperty({ type: String })
  lastName!: string;

  @ApiProperty({ type: String, example: '0912345678' })
  phone!: string;

  @ApiProperty({ type: String, format: 'date', nullable: true })
  dateOfBirth!: string | null;

  @ApiProperty({
    enum: [...GENDERS],
    enumName: GENDER_ENUM_NAME,
    nullable: true,
  })
  gender!: Gender | null;

  @ApiProperty({ type: String, format: 'uuid' })
  branchId!: string;

  @ApiProperty({ type: String, example: 'Bole' })
  branchName!: string;

  @ApiProperty({
    type: Boolean,
    description:
      'Barred from the premises. Says nothing about whether they have paid.',
  })
  isSuspended!: boolean;

  @ApiProperty({
    enum: [...MEMBERSHIP_STATUSES],
    enumName: MEMBERSHIP_STATUS_ENUM_NAME,
    description:
      'Derived from their memberships on every read, **never stored**, so it ' +
      'cannot go stale.\n\n' +
      '`active` — a membership covers today. `upcoming` — they have bought ' +
      'one but every period still lies ahead, either an early renewal or a ' +
      'walk-in starting next month; nobody owes anything, so do not treat it ' +
      'as expired. `expired` — they have bought before and nothing covers ' +
      'today, which does mean they owe money. `never` — they have never ' +
      'bought one, a real answer rather than missing data.\n\n' +
      'Independent of `isSuspended`: a paid-up member can be barred, and a ' +
      'lapsed one is not.',
  })
  membershipStatus!: MembershipStatus;

  @ApiProperty({
    type: String,
    format: 'date',
    nullable: true,
    example: '2026-10-06',
    description:
      'The last day covered by any membership — **inclusive** — or null when ' +
      'there has never been one. Show it beside an `active` badge: "active ' +
      'until 30 Nov" is what the front desk needs, not just a green dot.',
  })
  expiresOn!: string | null;

  @ApiProperty({
    type: String,
    format: 'date',
    nullable: true,
    example: '2026-10-07',
    description:
      'The first day of the soonest membership that has not started yet, or ' +
      'null if none is pending.\n\nHere so a member refused as `upcoming` can ' +
      'be told "come back on the 1st" without opening their record. Note it ' +
      'is the START of the pending period, where `expiresOn` is the END of ' +
      'the last one — a member can carry both at once, having renewed early.',
  })
  nextStartsOn!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;
}

/** GET /members/{id} — the list row plus the columns only the detail selects. */
export class MemberDetailDto extends MemberListItemDto {
  @ApiProperty({ type: String, nullable: true, example: 'Almaz Bekele' })
  emergencyContactName!: string | null;

  @ApiProperty({ type: String, nullable: true, example: '0116000000' })
  emergencyContactPhone!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;
}

/** DELETE /members/{id} returns only the id of the soft-deleted person. */
export class MemberDeletedDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;
}

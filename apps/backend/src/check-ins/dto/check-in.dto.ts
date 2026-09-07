import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsDateString,
  IsOptional,
  IsUUID,
  Matches,
} from 'class-validator';

import { DATE_ONLY_PATTERN } from '../../common/gym-day';
import { PaginationDto } from '../../common/pagination.dto';

/**
 * One field, and that is the whole point: everything else about a check-in is
 * decided by the server. The branch comes from the member's home gym, the
 * recorder from the access token, the day from the gym's clock and the
 * membership from what actually covers that day — none of them are things a
 * desk should be able to assert.
 */
export class RecordCheckInDto {
  @ApiProperty({
    type: String,
    format: 'uuid',
    description:
      'The member’s person id. A member at another branch 404s rather than ' +
      '403s, so this cannot be used to discover ids.',
  })
  @IsUUID()
  memberId!: string;

  @ApiPropertyOptional({
    type: Boolean,
    default: false,
    description:
      'Admit them anyway, despite an expired, not-yet-started or absent ' +
      'membership. Requires `checkin.override`; without that permission it is ' +
      'ignored and the refusal stands.\n\n' +
      'It must be asked for. Overriding automatically for anyone holding the ' +
      'permission would mean a manager scanning an unpaid member sees a green ' +
      'light and is never told to sell them a renewal — and would reduce ' +
      '`overrideByName` to "whoever happened to hold the permission" rather ' +
      'than a record of someone deciding.\n\n' +
      'Never lifts a suspension: that is a decision about the person, not a ' +
      'billing state.',
  })
  @IsOptional()
  @IsBoolean()
  override?: boolean;

  // No `branchId`, no `checkedInOn` and no `overrideByStaffId`. The whitelisting
  // ValidationPipe strips anything sent for them, so who recorded the override
  // still comes from the token — only the *decision* is the client's.
}

/**
 * `search` is inherited from PaginationDto and ignored here — a check-in
 * carries no text of its own, and matching on the member's name would need a
 * join whose misses read as "they did not come in", which is worse than no
 * search at all.
 */
export class CheckInQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    type: String,
    format: 'date',
    pattern: DATE_ONLY_PATTERN.source,
    example: '2026-09-01',
    description:
      'First gym day to include, **date only** and reckoned in the gym’s own ' +
      'timezone (Africa/Addis_Ababa), not UTC.\n\n' +
      '`from` and `to` both default to **today**, so an unfiltered call is ' +
      'the desk’s view of the day rather than every visit the gym has ever ' +
      'recorded. Pass both for a range; pass the same date twice for one day.',
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
    example: '2026-09-30',
    description:
      'Last gym day to include, inclusive. Defaults to today. A `to` earlier ' +
      'than `from` returns nothing rather than erroring — the range is empty, ' +
      'which is a true answer.',
  })
  @IsOptional()
  @Matches(DATE_ONLY_PATTERN, {
    message: 'to must be a date in YYYY-MM-DD form',
  })
  @IsDateString({ strict: true })
  to?: string;

  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    description:
      'One member’s attendance for the day. An out-of-scope member 404s ' +
      'rather than returning an empty list, which would read as “they did ' +
      'not come in”.',
  })
  @IsOptional()
  @IsUUID()
  memberId?: string;

  @ApiPropertyOptional({
    type: String,
    format: 'uuid',
    description:
      'One branch’s door. A branch-scoped caller naming another branch gets ' +
      'an empty page rather than an error — their own scope still applies on ' +
      'top of this.',
  })
  @IsOptional()
  @IsUUID()
  branchId?: string;
}

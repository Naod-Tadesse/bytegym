import { ApiProperty } from '@nestjs/swagger';

/**
 * Mirrors what `ReportsService` selects. Documentation only — nothing binds
 * this to the query, so the two change together.
 */
export class DashboardMembersDto {
  @ApiProperty({
    type: Number,
    example: 128,
    description: 'Every live member.',
  })
  total!: number;

  @ApiProperty({
    type: Number,
    example: 94,
    description: 'A membership is running today. They may train.',
  })
  active!: number;

  @ApiProperty({
    type: Number,
    example: 21,
    description: 'Held a membership, it ran out.',
  })
  expired!: number;

  @ApiProperty({
    type: Number,
    example: 7,
    description:
      'Registered, never bought one. A real state, not missing data — the ' +
      'next step is a first sale rather than chasing a lapse.',
  })
  never!: number;

  @ApiProperty({
    type: Number,
    example: 28,
    description:
      '`expired + never` — nobody with a membership running today, which is ' +
      'the list worth calling. Summed server-side so "inactive" has one ' +
      'definition rather than one per screen.',
  })
  inactive!: number;

  @ApiProperty({
    type: Number,
    example: 2,
    description:
      'Barred from the premises. **Overlaps every count above**: suspension ' +
      'is a decision about the person, not a billing state, so a suspended ' +
      'member is still counted as active if their membership is running ' +
      'today. ' +
      'Never add this to the others.',
  })
  suspended!: number;
}

export class DashboardPaymentsDto {
  @ApiProperty({ type: Number, example: 9, description: 'Payments taken.' })
  count!: number;

  @ApiProperty({
    type: String,
    example: '12400.00',
    description:
      'What the till holds, as a **string** — numeric(12,2) all the way to ' +
      'the client so no float rounding is possible. Voided payments are not ' +
      'counted; `"0.00"` on a day with none, never `null`.',
  })
  received!: string;
}

export class DashboardDto {
  @ApiProperty({ type: DashboardMembersDto })
  members!: DashboardMembersDto;

  @ApiProperty({
    type: Number,
    example: 43,
    description:
      'Visits recorded on the **gym’s** today, not UTC’s. One per member ' +
      'at most — the door records a member once a day.',
  })
  checkInsToday!: number;

  @ApiProperty({ type: DashboardPaymentsDto })
  paymentsToday!: DashboardPaymentsDto;
}

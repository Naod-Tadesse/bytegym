import { ApiProperty } from '@nestjs/swagger';

/**
 * Mirrors what `MembershipsService` selects. Documentation only — nothing binds
 * this to the query, so the two change together. Nullable columns are
 * `nullable: true`, never optional: the key is always present, carrying null.
 */
export class MembershipDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({
    type: String,
    format: 'uuid',
    description: 'The member’s person id.',
  })
  memberId!: string;

  @ApiProperty({ type: String, format: 'uuid' })
  planId!: string;

  @ApiProperty({
    type: String,
    example: 'Monthly',
    description:
      'The plan’s current name, joined for display. The price below is NOT ' +
      'joined — it is the snapshot taken at sale.',
  })
  planName!: string;

  @ApiProperty({ type: String, format: 'date', example: '2026-09-07' })
  startsOn!: string;

  @ApiProperty({
    type: String,
    format: 'date',
    example: '2026-10-06',
    description:
      '**Inclusive** — the last day the member may train. A 30-day plan ' +
      'starting on the 7th ends on the 6th of the next month, not the 7th.',
  })
  endsOn!: string;

  @ApiProperty({
    type: String,
    example: '1500.00',
    description:
      'A **string**, not a number: numeric(12,2) all the way to the client so ' +
      'no float rounding is possible.\n\nThis is a **snapshot** of the plan’s ' +
      'price at the moment of sale, and stays right even after the plan is ' +
      'repriced or retired. Never render history from `membership_plans.price`.',
  })
  price!: string;

  @ApiProperty({
    type: String,
    example: '900.00',
    description:
      'The one-off joining fee, **snapshotted at sale** from the plan and ' +
      '`"0.00"` for everyone who is not joining for the first time. "First ' +
      'time" means no prior membership rows at all — someone who lapsed years ' +
      'ago and comes back has already paid it.\n\n' +
      'Its own field rather than folded into `price` on purpose: folding ' +
      'makes registration income unreportable, and `price` has to keep ' +
      'meaning what the plan cost so a later price rise still reads correctly ' +
      'against history.',
  })
  registrationFee!: string;

  @ApiProperty({
    type: String,
    example: '2400.00',
    description:
      '`price + registrationFee`, added in SQL so no caller does arithmetic ' +
      'on two money strings in JavaScript. This is what the sale charged, and ' +
      'what `POST /memberships` takes when a `payment` is sent with it.\n\n' +
      'A complimentary membership still reports what it was worth here — the ' +
      'value given away — while owing `0.00`. Read `balance` for the debt.',
  })
  amountDue!: string;

  @ApiProperty({
    type: String,
    example: '800.00',
    description:
      'What has been paid against this membership, summed from the payments ' +
      'table on every read and **never stored**. Voided payments do not ' +
      'count.\n\nA **string**, like every money field, and always carrying ' +
      'two decimals — `"0.00"` when nothing has been paid, never `"0"`.',
  })
  paidTotal!: string;

  @ApiProperty({
    type: String,
    example: '700.00',
    description:
      'What is still owed: `amountDue - paidTotal`, derived in SQL — so the ' +
      'joining fee is part of the debt on a first sale. Many payments against ' +
      'one membership is the normal case — 800 now, the rest on Friday — so ' +
      'this is what the front desk reads, not whether a payment exists.\n\n' +
      'Always `"0.00"` when `isComplimentary` is true: the price and joining ' +
      'fee are still snapshotted so the value given away can be reported, but ' +
      'nothing is owed. Callers can therefore treat any positive balance as ' +
      'money outstanding without special-casing comps.\n\nGoes ' +
      '**negative** on an overpayment; nothing caps a payment at the ' +
      'outstanding amount.',
  })
  balance!: string;

  @ApiProperty({
    type: Boolean,
    description:
      'A comped period. The price and joining fee are still recorded, and ' +
      'the balance is `0.00`.',
  })
  isComplimentary!: boolean;

  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    description:
      'Who sold it, taken from the access token. Null on imported rows.',
  })
  soldByStaffId!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'System Admin',
    description: 'The seller’s full name, joined for display.',
  })
  soldByName!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;
}

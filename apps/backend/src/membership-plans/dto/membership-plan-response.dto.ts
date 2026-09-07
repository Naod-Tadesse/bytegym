import { ApiProperty } from '@nestjs/swagger';

/**
 * Mirrors `select()` on the membership_plans table. Documentation only —
 * nothing binds this to what the service selects, so the two change together.
 * Nullable columns are `nullable: true`, never optional: the key is always
 * present, carrying null.
 */
export class MembershipPlanDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, example: 'Monthly' })
  name!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'Full gym access for 30 days.',
  })
  description!: string | null;

  @ApiProperty({
    type: Number,
    example: 30,
    description: 'Days of cover. The end date is inclusive.',
  })
  durationDays!: number;

  @ApiProperty({
    type: String,
    example: '1500.00',
    description:
      'A **string**, not a number. The column is numeric(12,2) and stays a ' +
      'string all the way to the client so no float rounding is possible. ' +
      'Format it for display; never do arithmetic on it in JS.',
  })
  price!: string;

  @ApiProperty({
    type: String,
    example: '900.00',
    description:
      'The one-off joining fee, a **string** for the same reason as `price`. ' +
      '`"0.00"` on a plan that charges none.\n\nCharged only on a member’s ' +
      'very first membership and snapshotted onto it, so what a first sale ' +
      'costs is `price + registrationFee` — the `amountDue` the membership ' +
      'reports back.',
  })
  registrationFee!: string;

  @ApiProperty({
    type: Boolean,
    description:
      'Plans are retired by flipping this, never deleted — every membership ' +
      'ever sold points at the row.',
  })
  isActive!: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;
}

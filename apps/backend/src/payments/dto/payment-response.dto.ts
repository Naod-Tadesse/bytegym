import { ApiProperty } from '@nestjs/swagger';

import {
  PAYMENT_METHOD_ENUM_NAME,
  PAYMENT_METHODS,
  type PaymentMethod,
} from '../../common/enums';

/**
 * Mirrors what `PaymentsService` selects. Documentation only — nothing binds
 * this to the query, so the two change together. Nullable columns are
 * `nullable: true`, never optional: the key is always present, carrying null.
 */
export class PaymentDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({
    type: String,
    format: 'uuid',
    description: 'The payer’s person id.',
  })
  memberId!: string;

  @ApiProperty({ type: String, example: 'Abebe Bekele' })
  memberName!: string;

  @ApiProperty({
    type: String,
    format: 'uuid',
    description:
      'The membership settled. **Never null** — a payment is only ever for a ' +
      'membership, and every one of them moves that membership’s `balance`. ' +
      'The joining fee is `registrationFee` on the membership itself, not a ' +
      'payment of its own.',
  })
  membershipId!: string;

  @ApiProperty({
    type: String,
    format: 'uuid',
    description:
      'Where the money was taken — the member’s home gym at the time, not the ' +
      'caller’s. The column branch scope filters on.',
  })
  branchId!: string;

  @ApiProperty({ type: String, example: 'Main Branch' })
  branchName!: string;

  @ApiProperty({
    type: String,
    example: '800.00',
    description:
      'A **string**, not a number: numeric(12,2) all the way to the client so ' +
      'no float rounding is possible. Still carries its full value on a ' +
      'voided row — `voidedAt` is what says it no longer counts.',
  })
  amount!: string;

  @ApiProperty({
    enum: [...PAYMENT_METHODS],
    enumName: PAYMENT_METHOD_ENUM_NAME,
  })
  method!: PaymentMethod;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'TB2409071234',
    description: 'Transaction id from the receipt. Free text.',
  })
  reference!: string | null;

  @ApiProperty({ type: String, nullable: true })
  note!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'System Admin',
    description:
      'The cashier’s full name, joined for display. Null only if their person ' +
      'row has since gone.',
  })
  receivedByName!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  receivedAt!: string;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description:
      'When the payment was reversed, or null. **A voided payment is not ' +
      'removed from this list** — it is the row an audit needs most. Render ' +
      'it struck through; only the totals exclude it.',
  })
  voidedAt!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'Entered twice by mistake',
    description: 'Why it was reversed. Set together with `voidedAt`.',
  })
  voidReason!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'System Admin',
    description:
      'Who reversed it. Set together with `voidedAt`, and the other half of ' +
      'what makes a void auditable rather than just a struck-through number.',
  })
  voidedByName!: string | null;
}

/**
 * The extra key beside `data` and `meta` on the payments list.
 *
 * Its own class so the schema is a `$ref` rather than an inline object that
 * codegen would emit anonymously at each usage.
 */
export class PaymentTotalsDto {
  @ApiProperty({
    type: String,
    example: '1500.00',
    description:
      'Sum of the **non-voided** amounts across the whole filter, not just ' +
      'this page — the number a receptionist counts the drawer against. It ' +
      'comes from SQL `SUM()`; adding up `data[].amount` in the client would ' +
      'total one page of a many-page list and would count voided rows.',
  })
  received!: string;
}

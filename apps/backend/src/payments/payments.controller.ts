import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import {
  ApiBadRequestError,
  ApiConflictError,
  ApiNotFoundError,
} from '../common/api-errors.decorator';
import { branchScopeOf } from '../common/branch-scope';
import { ApiPaymentListResponse } from './api-payment-list-response.decorator';
import { PaymentDto } from './dto/payment-response.dto';
import {
  PaymentQueryDto,
  RecordPaymentDto,
  VoidPaymentDto,
} from './dto/payment.dto';
import { PaymentsService } from './payments.service';

/**
 * Taken and voided, never edited or deleted — hence no PUT, no PATCH beyond
 * the void, and no DELETE. A payment is a record of what happened at the desk;
 * correcting one adds a reversal beside it rather than rewriting it.
 */
@ApiTags('Payments')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Permissions('payment.list')
  @Get()
  @ApiOperation({
    summary: 'List payments',
    description:
      'Newest first, filtered by any combination of `memberId`, ' +
      '`membershipId`, `branchId` and a `from`/`to` gym-day range.\n\n' +
      '**Voided payments are included.** A reversal is the row a shift ' +
      'reconciliation needs most, so it stays in the list carrying its reason ' +
      'and who voided it — render it struck through rather than filtering it ' +
      'out. Only `totals.received` excludes voided rows.\n\n' +
      '`totals.received` is a SQL `SUM()` over the **whole filter**, not the ' +
      'page: it is the number a receptionist counts the drawer against, and ' +
      'adding up `data[].amount` in the client would total one page of many.\n\n' +
      '`from` and `to` are inclusive and reckoned in the gym’s own timezone, ' +
      'so a payment taken at 01:00 belongs to the shift that took it.\n\n' +
      'A branch-scoped caller sees only their own branch. `search` is ' +
      'inherited from the shared pagination query and is ignored here.',
  })
  @ApiPaymentListResponse()
  @ApiBadRequestError()
  @ApiNotFoundError('Member not found, or Membership not found')
  findAll(
    @Query() query: PaymentQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.paymentsService.findAll(query, branchScopeOf(user));
  }

  @Permissions('payment.record')
  @Post()
  @ApiOperation({
    summary: 'Record a payment against a membership',
    description:
      'Takes money against a membership. **`membershipId` is required** — a ' +
      'payment is only ever for a membership. The joining fee is no longer a ' +
      'payment of its own: it is `registrationFee` on the membership, part of ' +
      'its `amountDue`.\n\n' +
      'This is the **instalment** path, and the reason it carries its own ' +
      '`amount`: 800 now, the rest on Friday. Nothing here closes a ' +
      'membership off, and nothing caps the amount at what is outstanding. ' +
      'What is owed is the `balance` on the membership, derived from these ' +
      'rows on every read.\n\n' +
      'To take the **full** amount at the moment of sale, do not call this — ' +
      'send `payment` on `POST /memberships` and the server prices it, in the ' +
      'same transaction as the sale.\n\n' +
      'The cashier comes from the access token and the branch from the ' +
      'member’s home gym; there is no field for either. 404s when the member ' +
      'or the membership is not at the caller’s branch, and 400s when the ' +
      'membership named belongs to someone else.',
  })
  @ApiCreatedResponse({ type: PaymentDto })
  @ApiBadRequestError(
    'Body failed validation, or the membership belongs to a different member.',
  )
  @ApiNotFoundError('Member not found, or Membership not found')
  record(
    @Body() dto: RecordPaymentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.paymentsService.record(
      dto,
      // Identity from the token, never the body.
      user.staffId,
      branchScopeOf(user),
    );
  }

  @Permissions('payment.void')
  @Patch(':id/void')
  @ApiOperation({
    summary: 'Void a payment',
    description:
      'Reverses a payment **without removing it**. The row keeps its amount ' +
      'and gains `voidedAt` and `voidReason`, stays in every list, and stops ' +
      'counting toward `totals.received` and toward a membership’s ' +
      '`paidTotal` — so the balance goes back up.\n\n' +
      'Voiding a payment that is already void is a 409: the first reversal ' +
      'is the one that happened, and overwriting its reason would lose why.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Payment id.' })
  @ApiOkResponse({ type: PaymentDto })
  @ApiBadRequestError()
  @ApiNotFoundError('Payment not found')
  @ApiConflictError('This payment has already been voided')
  void(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: VoidPaymentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.paymentsService.void(
      id,
      dto.reason,
      user.staffId,
      branchScopeOf(user),
    );
  }
}

import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
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
import { ApiPaginatedResponse } from '../common/api-paginated-response.decorator';
import { branchScopeOf } from '../common/branch-scope';
import { MembershipDto } from './dto/membership-response.dto';
import { MembershipQueryDto, SellMembershipDto } from './dto/membership.dto';
import { MembershipsService } from './memberships.service';

/**
 * Sold and voided, never edited — hence no PATCH and no DELETE here. Correcting
 * a mistaken sale voids it together with its payment, which keeps the money and
 * the cover consistent; editing dates in place would silently move both.
 */
@ApiTags('Memberships')
@Controller('memberships')
export class MembershipsController {
  constructor(private readonly membershipsService: MembershipsService) {}

  @Permissions('membership.list')
  @Get()
  @ApiOperation({
    summary: 'List memberships',
    description:
      'Newest first. Pass `memberId` for one member’s history — that is the ' +
      'normal use, since memberships are read through a member.\n\n' +
      'A branch-scoped caller sees only their own branch: a membership has no ' +
      'branch of its own and scopes through the member’s home gym. An ' +
      'out-of-scope `memberId` 404s rather than returning an empty list.\n\n' +
      '`search` is inherited from the shared pagination query and is ignored ' +
      'here — a membership carries no text worth matching.',
  })
  @ApiPaginatedResponse(MembershipDto)
  @ApiBadRequestError()
  @ApiNotFoundError('Member not found')
  findAll(
    @Query() query: MembershipQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.membershipsService.findAll(query, branchScopeOf(user));
  }

  @Permissions('membership.list')
  @Get(':id')
  @ApiOperation({
    summary: 'Get one membership',
    description:
      'Deliberately membership.list rather than a separate read permission: ' +
      'seeing the history and opening a row are the same decision.',
  })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Membership id.' })
  @ApiOkResponse({ type: MembershipDto })
  @ApiBadRequestError()
  @ApiNotFoundError('Membership not found')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.membershipsService.findOne(id, branchScopeOf(user));
  }

  @Permissions('membership.sell')
  @Post()
  @ApiOperation({
    summary: 'Sell a membership, and take the payment for it',
    description:
      'Prices the plan, computes the end date, records the sale **and, when ' +
      '`payment` is sent, takes the money — all in one transaction.** Selling ' +
      'and paying are one act at the desk, so they either both happen or ' +
      'neither does.\n\n' +
      '**There is no `amount` field.** The server charges the full amount ' +
      'due, `price + registrationFee`, computed from the row it just wrote. ' +
      'That is what "the amount is displayed automatically" means, and it ' +
      'stops a client under-charging by editing a number.\n\n' +
      '`registrationFee` is the plan’s one-off joining fee, snapshotted here ' +
      'and charged **only when the member has never held a membership**. ' +
      'That is decided server-side inside the transaction, never from a flag ' +
      'in the body; a member who lapsed years ago and returns pays `0.00`. ' +
      'Members carry `membershipStatus`, and `never` is how the UI knows a ' +
      'joining fee is coming.\n\n' +
      'Omit `payment` to sell with nothing paid — that is how an instalment ' +
      'starts, and the balance is then settled through `POST /payments`.\n\n' +
      '`endsOn` is **inclusive** and derived as `startsOn + durationDays - 1`, ' +
      'so a 30-day plan starting today ends on day 29. `price` is snapshotted ' +
      'from the plan, so repricing or retiring it later leaves history intact. ' +
      'The seller and the cashier come from the access token, and the branch ' +
      'from the member’s home gym — there is no field for any of them.\n\n' +
      '**One live membership at a time.** A member with a membership that has ' +
      'not run out is refused with a 409 naming the day it does — including ' +
      'one that is only booked ahead. Renewing early is therefore not ' +
      'possible: they buy again on or after the day it lapses. The check runs ' +
      'inside the transaction, under a lock on the member, so two ' +
      'receptionists selling at once cannot both succeed.\n\n' +
      'A database exclusion constraint still refuses two memberships covering ' +
      'the same day, and is the integrity floor under the rule above.\n\n' +
      'Sending `payment` additionally requires **`payment.record`**: the sale ' +
      'writes a payment row, and `membership.sell` alone must not be a way ' +
      'round the permission that gates taking money. Selling without it needs ' +
      'only `membership.sell`.\n\n' +
      '400s when the plan is missing or retired, and when a `payment` is sent ' +
      'for a complimentary membership — nothing is owed, so there is nothing ' +
      'to take. 404s when the member is not at the caller’s branch.',
  })
  @ApiCreatedResponse({ type: MembershipDto })
  @ApiBadRequestError(
    'Body failed validation, the plan is missing or retired, or a payment ' +
      'was sent for a membership that owes nothing.',
  )
  @ApiNotFoundError('Member not found')
  @ApiConflictError(
    'This member already has an active membership that has not run out',
  )
  sell(@Body() dto: SellMembershipDto, @CurrentUser() user: AuthenticatedUser) {
    return this.membershipsService.sell(
      dto,
      // Identity from the token, never the body.
      user.staffId,
      branchScopeOf(user),
      // Taking the money is a second act with its own permission — see the
      // check in `sell`. Passing the claims rather than a boolean keeps the
      // decision in the service, beside the write it guards.
      user.permissions,
    );
  }
}

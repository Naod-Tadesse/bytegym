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

import { Permissions } from '../auth/decorators/permissions.decorator';
import {
  ApiBadRequestError,
  ApiConflictError,
  ApiNotFoundError,
} from '../common/api-errors.decorator';
import { ApiPaginatedResponse } from '../common/api-paginated-response.decorator';
import { MembershipPlanQueryDto } from './dto/membership-plan-query.dto';
import { MembershipPlanDto } from './dto/membership-plan-response.dto';
import {
  CreateMembershipPlanDto,
  UpdateMembershipPlanDto,
} from './dto/membership-plan.dto';
import { MembershipPlansService } from './membership-plans.service';

/** Shared by every route taking a plan id. */
const PlanIdParam = () =>
  ApiParam({ name: 'id', format: 'uuid', description: 'Membership plan id.' });

@ApiTags('Membership plans')
@Controller('membership-plans')
export class MembershipPlansController {
  constructor(
    private readonly membershipPlansService: MembershipPlansService,
  ) {}

  @Permissions('plan.list')
  @Get()
  @ApiOperation({
    summary: 'List membership plans',
    description:
      '`search` matches the plan name. Retired plans are included by ' +
      'default — pass `isActive=true` for only what can still be sold, which ' +
      'is what a sell-membership picker wants.\n\nPlans are gym-wide, so ' +
      'there is no branch scoping here.',
  })
  @ApiPaginatedResponse(MembershipPlanDto)
  findAll(@Query() query: MembershipPlanQueryDto) {
    return this.membershipPlansService.findAll(query);
  }

  @Permissions('plan.list')
  @Get(':id')
  @ApiOperation({
    summary: 'Get one membership plan',
    description:
      'Deliberately plan.list rather than a separate read permission: the ' +
      'catalogue is not confidential, so seeing the list and opening a row ' +
      'are the same decision.',
  })
  @PlanIdParam()
  @ApiOkResponse({ type: MembershipPlanDto })
  @ApiBadRequestError()
  @ApiNotFoundError('Membership plan not found')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.membershipPlansService.findOne(id);
  }

  @Permissions('plan.create')
  @Post()
  @ApiOperation({
    summary: 'Create a membership plan',
    description:
      '`price` and `registrationFee` are decimal strings (`"1500.00"`), and ' +
      'come back as ones. `registrationFee` is the one-off joining fee and ' +
      'defaults to `"0"`; it is charged only on a member’s very first ' +
      'membership, snapshotted onto it, and added to the price to give what ' +
      'the sale takes.\n\n' +
      'This is also how you **raise a price**: create the replacement plan ' +
      'and retire the old one with PATCH `{ isActive: false }`. Never edit a ' +
      'price in place — memberships snapshot the price at sale so the money ' +
      'is safe either way, but reusing the row makes reports lie about which ' +
      'product sold in which month.',
  })
  @ApiCreatedResponse({ type: MembershipPlanDto })
  @ApiBadRequestError()
  @ApiConflictError('A plan with this name already exists')
  create(@Body() dto: CreateMembershipPlanDto) {
    return this.membershipPlansService.create(dto);
  }

  @Permissions('plan.update')
  @Patch(':id')
  @ApiOperation({
    summary: 'Update a membership plan',
    description:
      'Only the fields you send are changed.\n\nThere is no DELETE: every ' +
      'membership ever sold points at a plan, so retiring one means PATCHing ' +
      '`{ isActive: false }`. That is why there is no `plan.delete` ' +
      'permission either — the same deliberate gap as branches.',
  })
  @PlanIdParam()
  @ApiOkResponse({ type: MembershipPlanDto })
  @ApiBadRequestError()
  @ApiNotFoundError('Membership plan not found')
  @ApiConflictError('A plan with this name already exists')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMembershipPlanDto,
  ) {
    return this.membershipPlansService.update(id, dto);
  }
}

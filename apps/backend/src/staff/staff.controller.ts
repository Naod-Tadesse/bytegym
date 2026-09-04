import {
  Body,
  Controller,
  Delete,
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
import { ApiPaginatedResponse } from '../common/api-paginated-response.decorator';
import { PaginationDto } from '../common/pagination.dto';
import {
  StaffDeletedDto,
  StaffDetailDto,
  StaffListItemDto,
  StaffProfileDto,
} from './dto/staff-response.dto';
import { CreateStaffDto, UpdateStaffDto } from './dto/staff.dto';
import { StaffService } from './staff.service';

/** Shared by every route taking a staff id — which is the user id. */
const StaffIdParam = () =>
  ApiParam({
    name: 'id',
    format: 'uuid',
    description:
      'The staff member’s user id (the `userId` field in responses).',
  });

@ApiTags('Staff')
@Controller('staff')
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Permissions('staff.list')
  @Get()
  @ApiOperation({
    summary: 'List staff',
    description:
      '`search` matches first name, last name, phone or staff code. ' +
      'Soft-deleted users are excluded; terminated ones are not.',
  })
  @ApiPaginatedResponse(StaffListItemDto)
  findAll(@Query() query: PaginationDto) {
    return this.staffService.findAll(query);
  }

  @Permissions('staff.read')
  @Get(':id')
  @ApiOperation({
    summary: 'Get one staff member',
    description: 'Note this needs staff.read, while the list needs staff.list.',
  })
  @StaffIdParam()
  @ApiOkResponse({ type: StaffDetailDto })
  @ApiBadRequestError()
  @ApiNotFoundError('Staff member not found')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.staffService.findOne(id);
  }

  @Permissions('staff.create')
  @Post()
  @ApiOperation({
    summary: 'Create a staff member',
    description:
      'Writes the user, the staff profile and the role grants in one ' +
      'transaction. They can sign in immediately with the phone and password ' +
      'given here.',
  })
  @ApiCreatedResponse({
    type: StaffProfileDto,
    description:
      'The staff profile row only — narrower than GET /staff/{id}, with no ' +
      'names, phone, branch name or roles. Refetch for the full record.',
  })
  @ApiBadRequestError()
  @ApiConflictError('That phone number or staff code is already in use')
  create(@Body() dto: CreateStaffDto) {
    return this.staffService.create(dto);
  }

  @Permissions('staff.update')
  @Patch(':id')
  @ApiOperation({
    summary: 'Update a staff member',
    description:
      'Phone, password and staff code cannot be changed here. Sending ' +
      'roleIds replaces every grant and revokes their live sessions.',
  })
  @StaffIdParam()
  @ApiOkResponse({ type: StaffDetailDto })
  @ApiBadRequestError()
  @ApiNotFoundError('Staff member not found')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateStaffDto) {
    return this.staffService.update(id, dto);
  }

  @Permissions('staff.terminate')
  @Delete(':id')
  @ApiOperation({
    summary: 'Terminate a staff member',
    description:
      'Soft-deletes the user, marks the profile terminated with today’s date ' +
      'and revokes every session, so they are signed out at once. The record ' +
      'is kept so history still resolves.\n\n' +
      'Also 403s — on top of the missing-permission case — when {id} is your ' +
      'own account: you cannot terminate yourself.',
  })
  @StaffIdParam()
  @ApiOkResponse({
    type: StaffDeletedDto,
    description: 'Only the id of the terminated user.',
  })
  @ApiBadRequestError()
  @ApiNotFoundError('Staff member not found')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    // Identity comes from the token, never the body.
    return this.staffService.remove(id, user.staffId);
  }
}

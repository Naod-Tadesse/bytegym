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
import { branchScopeOf } from '../common/branch-scope';
import {
  StaffDeletedDto,
  StaffDetailDto,
  StaffListItemDto,
  StaffProfileDto,
} from './dto/staff-response.dto';
import {
  GrantStaffAccessDto,
  ResetStaffPasswordDto,
  SetAccountStatusDto,
  SetStaffAuthorizationDto,
} from './dto/reset-password.dto';
import { CreateStaffDto, UpdateStaffDto } from './dto/staff.dto';
import { StaffQueryDto } from './dto/staff-query.dto';
import { StaffService } from './staff.service';

/** Shared by every route taking a staff id — which is the person id. */
const StaffIdParam = () =>
  ApiParam({
    name: 'id',
    format: 'uuid',
    description:
      'The staff member’s person id (the `personId` field in responses).',
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
      'Soft-deleted people are excluded; terminated ones are not.',
  })
  @ApiPaginatedResponse(StaffListItemDto)
  findAll(
    @Query() query: StaffQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.staffService.findAll(query, branchScopeOf(user));
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
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.staffService.findOne(id, branchScopeOf(user));
  }

  @Permissions('staff.create')
  @Post()
  @ApiOperation({
    summary: 'Create a staff member',
    description:
      'Writes the person, the staff row and the role grants in one ' +
      'transaction. They can sign in immediately with the phone and password ' +
      'given here.',
  })
  @ApiCreatedResponse({
    type: StaffProfileDto,
    description:
      'The staff row only — narrower than GET /staff/{id}, with no names, ' +
      'phone, branch name or roles. Refetch for the full record.',
  })
  @ApiBadRequestError()
  @ApiConflictError('That phone number or staff code is already in use')
  create(@Body() dto: CreateStaffDto, @CurrentUser() user: AuthenticatedUser) {
    return this.staffService.create(dto, branchScopeOf(user));
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
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStaffDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.staffService.update(id, dto, branchScopeOf(user));
  }

  @Permissions('staff.resetPassword')
  @Patch(':id/password')
  @ApiOperation({
    summary: 'Reset a staff member’s password',
    description:
      'For a locked-out colleague — the caller does not need their current ' +
      'password. Every session of theirs is revoked, so they must sign in ' +
      'again with the new one. Staff changing their own password use ' +
      'PATCH /auth/change-password instead, which does require the old one.',
  })
  @StaffIdParam()
  @ApiOkResponse({
    type: StaffDeletedDto,
    description: 'The id of the staff member whose password was reset.',
  })
  @ApiBadRequestError()
  @ApiNotFoundError('Staff member not found')
  resetPassword(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResetStaffPasswordDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.staffService.resetPassword(
      id,
      dto.newPassword,
      branchScopeOf(user),
    );
  }

  @Permissions('staff.grantAccess')
  @Post(':id/access')
  @ApiOperation({
    summary: 'Give a staff member system access',
    description:
      'Creates their account — the row whose existence IS the right to sign ' +
      'in — and its role grants, in one transaction. Use this for an employee ' +
      'hired without a login, not for a locked-out one (that is ' +
      'PATCH /:id/password).\n\n' +
      '400s when their job title has `canHaveAccount: false` — a cleaner is a ' +
      'full employee the API will not hand credentials to — and when they are ' +
      'terminated. 409s when they already have access.',
  })
  @StaffIdParam()
  @ApiOkResponse({
    type: StaffDeletedDto,
    description: 'The id of the staff member who was given access.',
  })
  @ApiBadRequestError()
  @ApiNotFoundError('Staff member not found')
  @ApiConflictError('This staff member already has system access')
  grantAccess(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: GrantStaffAccessDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.staffService.grantAccess(id, dto, branchScopeOf(user));
  }

  @Permissions('role.assign')
  @Patch(':id/authorization')
  @ApiOperation({
    summary: 'Set a staff member’s roles and data scope',
    description:
      'The access half of managing someone, deliberately separate from ' +
      'PATCH /staff/{id}: this answers to `role.assign`, so access can be ' +
      'managed without also being able to edit names and job titles.\n\n' +
      '`roleIds` is a full replace — anything omitted is revoked; omit the ' +
      'field entirely to leave roles alone. Both fields are baked into the ' +
      'access token, so either changing revokes their staff sessions.\n\n' +
      '400s when they have no account: roles hang off one, so there is ' +
      'nothing to authorise.',
  })
  @StaffIdParam()
  @ApiOkResponse({ type: StaffDetailDto })
  @ApiBadRequestError()
  @ApiNotFoundError('Staff member not found')
  setAuthorization(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetStaffAuthorizationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.staffService.setAuthorization(id, dto, branchScopeOf(user));
  }

  @Permissions('staff.revokeAccess')
  @Patch(':id/access')
  @ApiOperation({
    summary: 'Disable or re-enable a staff member’s login',
    description:
      'The reversible middle ground between doing nothing and revoking. ' +
      '`disabled` refuses sign-in and revokes their live sessions but KEEPS ' +
      'the password, so setting `active` hands back the credential they ' +
      'already know — use it for a suspension you intend to lift. Revoking ' +
      '(DELETE) deletes the account outright and their roles with it.\n\n' +
      'Also 403s when {id} is your own account and you are disabling: you ' +
      'cannot lock yourself out.',
  })
  @StaffIdParam()
  @ApiOkResponse({
    type: StaffDeletedDto,
    description: 'The id of the staff member whose login status changed.',
  })
  @ApiBadRequestError()
  @ApiNotFoundError('This staff member has no system access')
  setAccountStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetAccountStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    // Identity comes from the token, never the body.
    return this.staffService.setAccountStatus(
      id,
      dto.status,
      user.staffId,
      branchScopeOf(user),
    );
  }

  @Permissions('staff.revokeAccess')
  @Delete(':id/access')
  @ApiOperation({
    summary: 'Take away a staff member’s system access',
    description:
      'Deletes their account row and revokes every session. Their role grants ' +
      'go with it, since roles hang off the account. They stay on the roster ' +
      'and keep their employment history — they simply cannot sign in.\n\n' +
      'Also 403s when {id} is your own account: you cannot lock yourself out.',
  })
  @StaffIdParam()
  @ApiOkResponse({
    type: StaffDeletedDto,
    description: 'The id of the staff member whose access was revoked.',
  })
  @ApiBadRequestError()
  @ApiNotFoundError('This staff member has no system access')
  revokeAccess(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    // Identity comes from the token, never the body.
    return this.staffService.revokeAccess(
      id,
      user.staffId,
      branchScopeOf(user),
    );
  }

  @Permissions('staff.terminate')
  @Delete(':id')
  @ApiOperation({
    summary: 'Terminate a staff member',
    description:
      'Soft-deletes the person, marks the staff row terminated with today’s ' +
      'date and revokes every session, so they are signed out at once. The ' +
      'record is kept so history still resolves.\n\n' +
      'Also 403s — on top of the missing-permission case — when {id} is your ' +
      'own account: you cannot terminate yourself.',
  })
  @StaffIdParam()
  @ApiOkResponse({
    type: StaffDeletedDto,
    description: 'Only the id of the terminated person.',
  })
  @ApiBadRequestError()
  @ApiNotFoundError('Staff member not found')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    // Identity comes from the token, never the body.
    return this.staffService.remove(id, user.staffId, branchScopeOf(user));
  }
}

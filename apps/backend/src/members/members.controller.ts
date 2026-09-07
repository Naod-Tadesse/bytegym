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
import { PaginationDto } from '../common/pagination.dto';
import {
  MemberDeletedDto,
  MemberDetailDto,
  MemberListItemDto,
} from './dto/member-response.dto';
import {
  CreateMemberDto,
  SetMemberSuspensionDto,
  UpdateMemberDto,
} from './dto/member.dto';
import { MembersService } from './members.service';

/** Shared by every route taking a member id — which is the person id. */
const MemberIdParam = () =>
  ApiParam({
    name: 'id',
    format: 'uuid',
    description: 'The member’s person id (the `personId` field in responses).',
  });

@ApiTags('Members')
@Controller('members')
export class MembersController {
  constructor(private readonly membersService: MembersService) {}

  @Permissions('member.list')
  @Get()
  @ApiOperation({
    summary: 'List members',
    description:
      '`search` matches first name, last name, phone or member code. ' +
      'Removed members are excluded. A branch-scoped caller sees only their ' +
      'own branch.',
  })
  @ApiPaginatedResponse(MemberListItemDto)
  findAll(
    @Query() query: PaginationDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.membersService.findAll(query, branchScopeOf(user));
  }

  @Permissions('member.read')
  @Get(':id')
  @ApiOperation({
    summary: 'Get one member',
    description:
      'Note this needs member.read, while the list needs member.list. A ' +
      'member at another branch 404s rather than 403s, so the endpoint cannot ' +
      'be used to discover ids.',
  })
  @MemberIdParam()
  @ApiOkResponse({ type: MemberDetailDto })
  @ApiBadRequestError()
  @ApiNotFoundError('Member not found')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.membersService.findOne(id, branchScopeOf(user));
  }

  @Permissions('member.create')
  @Post()
  @ApiOperation({
    summary: 'Register a member',
    description:
      'Writes the person and the member row in one transaction, and draws the ' +
      'member code (`MBR00001`) from a sequence.\n\n' +
      '409s when the phone number already belongs to someone — including an ' +
      'existing staff member. Linking an existing person as a member is a ' +
      'later endpoint.\n\n' +
      '403s when a branch-scoped caller names a branch that is not theirs.',
  })
  @ApiCreatedResponse({ type: MemberDetailDto })
  @ApiBadRequestError()
  @ApiConflictError('A person with this phone number already exists')
  create(@Body() dto: CreateMemberDto, @CurrentUser() user: AuthenticatedUser) {
    return this.membersService.create(dto, branchScopeOf(user));
  }

  @Permissions('member.update')
  @Patch(':id')
  @ApiOperation({
    summary: 'Update a member',
    description:
      'Only the fields you send are changed. Phone and member code cannot be ' +
      'changed here, and suspension has its own endpoint.',
  })
  @MemberIdParam()
  @ApiOkResponse({ type: MemberDetailDto })
  @ApiBadRequestError()
  @ApiNotFoundError('Member not found')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMemberDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.membersService.update(id, dto, branchScopeOf(user));
  }

  @Permissions('member.update')
  @Patch(':id/suspension')
  @ApiOperation({
    summary: 'Suspend or reinstate a member',
    description:
      'Bars them from the premises, or lifts it. Separate from PATCH ' +
      '/members/{id} so a form echoing every field back cannot flip it by ' +
      'accident. Says nothing about whether they have paid — that is derived ' +
      'from their memberships.',
  })
  @MemberIdParam()
  @ApiOkResponse({ type: MemberDetailDto })
  @ApiBadRequestError()
  @ApiNotFoundError('Member not found')
  setSuspension(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetMemberSuspensionDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.membersService.setSuspension(
      id,
      dto.isSuspended,
      branchScopeOf(user),
    );
  }

  @Permissions('member.delete')
  @Delete(':id')
  @ApiOperation({
    summary: 'Remove a member',
    description:
      'Soft-deletes the person and KEEPS the member row, so their ' +
      'memberships, payments and check-ins still resolve to a name. They stop ' +
      'appearing in every list, and the phone number is freed for reuse.',
  })
  @MemberIdParam()
  @ApiOkResponse({
    type: MemberDeletedDto,
    description: 'Only the id of the soft-deleted person.',
  })
  @ApiBadRequestError()
  @ApiNotFoundError('Member not found')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.membersService.remove(id, branchScopeOf(user));
  }
}

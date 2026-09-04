import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
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
import { PaginationDto } from '../common/pagination.dto';
import {
  RoleDetailDto,
  RoleDto,
  SyncPermissionsResultDto,
} from './dto/role-response.dto';
import {
  CreateRoleDto,
  SyncRolePermissionsDto,
  UpdateRoleDto,
} from './dto/role.dto';
import { RolesService } from './roles.service';

/** Shared by every route taking a role id. */
const RoleIdParam = () =>
  ApiParam({ name: 'id', format: 'uuid', description: 'Role id.' });

@ApiTags('Roles')
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Permissions('role.list')
  @Get()
  @ApiOperation({
    summary: 'List roles',
    description:
      '`search` matches the role name. Soft-deleted roles are excluded.',
  })
  @ApiPaginatedResponse(RoleDto)
  findAll(@Query() query: PaginationDto) {
    return this.rolesService.findAll(query);
  }

  @Permissions('role.list')
  @Get(':id')
  @ApiOperation({
    summary: 'Get one role with its permissions',
    description:
      'The nested permissions are a five-column projection — no createdAt, ' +
      'unlike GET /permissions.',
  })
  @RoleIdParam()
  @ApiOkResponse({ type: RoleDetailDto })
  @ApiBadRequestError()
  @ApiNotFoundError('Role not found')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.rolesService.findOne(id);
  }

  @Permissions('role.create')
  @Post()
  @ApiOperation({
    summary: 'Create a role',
    description:
      'Created with no permissions — grant them via PUT .../permissions.',
  })
  @ApiCreatedResponse({ type: RoleDto })
  @ApiBadRequestError()
  @ApiConflictError(
    'A role with this name already exists (compared case-insensitively)',
  )
  create(@Body() dto: CreateRoleDto) {
    return this.rolesService.create(dto);
  }

  @Permissions('role.update')
  @Patch(':id')
  @ApiOperation({
    summary: 'Update a role',
    description: 'Renaming a role does not change what it can do.',
  })
  @RoleIdParam()
  @ApiOkResponse({ type: RoleDto })
  @ApiBadRequestError()
  @ApiNotFoundError('Role not found')
  @ApiConflictError(
    'A role with this name already exists (compared case-insensitively)',
  )
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRoleDto) {
    return this.rolesService.update(id, dto);
  }

  @Permissions('role.delete')
  @Delete(':id')
  @ApiOperation({
    summary: 'Soft-delete a role',
    description:
      'Stamps deletedAt, detaches the role from every staff member holding ' +
      'it, and revokes their sessions — otherwise a live token would keep ' +
      'carrying permissions from a role that no longer exists.',
  })
  @RoleIdParam()
  @ApiOkResponse({
    type: RoleDto,
    description: 'The deleted role, with deletedAt now set.',
  })
  @ApiBadRequestError()
  @ApiNotFoundError('Role not found')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.rolesService.remove(id);
  }

  @Permissions('role.assign')
  @Put(':id/permissions')
  @ApiOperation({
    summary: 'Replace a role’s permissions',
    description:
      'A full replace, not an append: send the complete desired set, and any ' +
      'permission missing from it is revoked. The write itself is diffed, so ' +
      'untouched grants are left alone.',
  })
  @RoleIdParam()
  @ApiOkResponse({
    type: SyncPermissionsResultDto,
    description: 'How many grants the diff actually added and removed.',
  })
  @ApiBadRequestError()
  @ApiNotFoundError('Role not found')
  syncPermissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SyncRolePermissionsDto,
  ) {
    return this.rolesService.syncPermissions(id, dto.permissionIds);
  }
}

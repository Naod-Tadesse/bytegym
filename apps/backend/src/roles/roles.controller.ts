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

import { Permissions } from '../auth/decorators/permissions.decorator';
import { PaginationDto } from '../common/pagination.dto';
import {
  CreateRoleDto,
  SyncRolePermissionsDto,
  UpdateRoleDto,
} from './dto/role.dto';
import { RolesService } from './roles.service';

@Controller()
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  /** Sits here rather than in its own module — it only ever feeds role editing. */
  @Permissions('role.list')
  @Get('permissions')
  listPermissions() {
    return this.rolesService.listPermissions();
  }

  @Permissions('role.list')
  @Get('roles')
  findAll(@Query() query: PaginationDto) {
    return this.rolesService.findAll(query);
  }

  @Permissions('role.list')
  @Get('roles/:id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.rolesService.findOne(id);
  }

  @Permissions('role.create')
  @Post('roles')
  create(@Body() dto: CreateRoleDto) {
    return this.rolesService.create(dto);
  }

  @Permissions('role.update')
  @Patch('roles/:id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateRoleDto) {
    return this.rolesService.update(id, dto);
  }

  @Permissions('role.delete')
  @Delete('roles/:id')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.rolesService.remove(id);
  }

  @Permissions('role.assign')
  @Put('roles/:id/permissions')
  syncPermissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SyncRolePermissionsDto,
  ) {
    return this.rolesService.syncPermissions(id, dto.permissionIds);
  }
}

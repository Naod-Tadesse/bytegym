import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Permissions } from '../auth/decorators/permissions.decorator';
import { PermissionDto } from './dto/role-response.dto';
import { RolesService } from './roles.service';

/**
 * Split out of RolesController purely so the two paths can carry different
 * OpenAPI tags — a bare @Controller() owning both meant neither tag was right.
 * The route is unchanged: still GET /api/permissions.
 */
@ApiTags('Permissions')
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly rolesService: RolesService) {}

  @Permissions('role.list')
  @Get()
  @ApiOperation({
    summary: 'The permission catalogue',
    description:
      'Every permission the system knows about, ordered by group then name. ' +
      'Fixed at seed time — there is no way to create one through the API. ' +
      'Not paginated.',
  })
  @ApiOkResponse({ type: [PermissionDto] })
  listPermissions() {
    return this.rolesService.listPermissions();
  }
}

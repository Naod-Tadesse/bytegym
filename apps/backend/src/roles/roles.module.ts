import { Module } from '@nestjs/common';

import { PermissionsController } from './permissions.controller';
import { RolesController } from './roles.controller';
import { RolesService } from './roles.service';

@Module({
  // PermissionsController is here rather than in a module of its own: it reads
  // from RolesService and only ever feeds role editing.
  controllers: [RolesController, PermissionsController],
  providers: [RolesService],
  exports: [RolesService],
})
export class RolesModule {}

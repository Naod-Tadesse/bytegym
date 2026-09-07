import { Module } from '@nestjs/common';

import { MembersModule } from '../members/members.module';
import { MembershipsController } from './memberships.controller';
import { MembershipsService } from './memberships.service';

@Module({
  // For MembersService.findOne, which is where the branch-scope 404 lives.
  imports: [MembersModule],
  controllers: [MembershipsController],
  providers: [MembershipsService],
  // Exported for phase 4: a payment is recorded against a membership.
  exports: [MembershipsService],
})
export class MembershipsModule {}

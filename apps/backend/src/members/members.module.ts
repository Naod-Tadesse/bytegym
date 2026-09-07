import { Module } from '@nestjs/common';

import { MembersController } from './members.controller';
import { MembersService } from './members.service';

@Module({
  controllers: [MembersController],
  providers: [MembersService],
  // Exported because memberships, payments and check-ins all resolve a member
  // through findOne, which is where the branch-scope 404 lives.
  exports: [MembersService],
})
export class MembersModule {}

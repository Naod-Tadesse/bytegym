import { Module } from '@nestjs/common';

import { MembersModule } from '../members/members.module';
import { MembershipsModule } from '../memberships/memberships.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  // Both for their findOne, which is where the branch-scope 404 lives.
  imports: [MembersModule, MembershipsModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}

import { Module } from '@nestjs/common';

import { MembershipPlansController } from './membership-plans.controller';
import { MembershipPlansService } from './membership-plans.service';

@Module({
  controllers: [MembershipPlansController],
  providers: [MembershipPlansService],
  // Exported so the memberships module can resolve and price a plan at sale.
  exports: [MembershipPlansService],
})
export class MembershipPlansModule {}

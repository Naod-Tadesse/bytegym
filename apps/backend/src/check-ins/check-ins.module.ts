import { Module } from '@nestjs/common';

import { MembersModule } from '../members/members.module';
import { CheckInsController } from './check-ins.controller';
import { CheckInsService } from './check-ins.service';

@Module({
  // For MembersService.findOne, which is where the branch-scope 404 lives and
  // which supplies the member's home branch and suspension flag.
  imports: [MembersModule],
  controllers: [CheckInsController],
  providers: [CheckInsService],
})
export class CheckInsModule {}

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';

import { AuthModule } from '../auth/auth.module';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { BranchesModule } from '../branches/branches.module';
import { CheckInsModule } from '../check-ins/check-ins.module';
import { DatabaseModule } from '../database/database.module';
import { HealthModule } from '../health/health.module';
import { JobTitlesModule } from '../job-titles/job-titles.module';
import { MembershipPlansModule } from '../membership-plans/membership-plans.module';
import { MembershipsModule } from '../memberships/memberships.module';
import { MembersModule } from '../members/members.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PaymentsModule } from '../payments/payments.module';
import { ReportsModule } from '../reports/reports.module';
import { RolesModule } from '../roles/roles.module';
import { SmsModule } from '../sms/sms.module';
import { StaffModule } from '../staff/staff.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env.local', '.env'],
    }),
    // Registered once, here: the cron decorators in feature modules do
    // nothing without it, and silently so.
    ScheduleModule.forRoot(),
    DatabaseModule,
    AuthModule,
    HealthModule,
    BranchesModule,
    CheckInsModule,
    JobTitlesModule,
    MembershipPlansModule,
    MembershipsModule,
    MembersModule,
    NotificationsModule,
    PaymentsModule,
    ReportsModule,
    RolesModule,
    SmsModule,
    StaffModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Order matters: authenticate first, then authorise. JwtAuthGuard honours
    // @Public(); PermissionsGuard treats "no @Permissions()" as
    // authenticated-only.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
})
export class AppModule {}

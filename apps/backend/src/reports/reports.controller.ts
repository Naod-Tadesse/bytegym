import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { branchScopeOf } from '../common/branch-scope';
import { DashboardDto } from './dto/dashboard-response.dto';
import { ReportsService } from './reports.service';

/**
 * Read-only, and aggregate only — no row here identifies anybody. Reporting is
 * one permission (`report.view`) rather than one per figure, because a number
 * that has been reduced to a count tells you nothing the individual screens
 * behind it do not.
 */
@ApiTags('Reports')
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Permissions('report.view')
  @Get('dashboard')
  @ApiOperation({
    summary: 'The dashboard’s figures',
    description:
      'Counts and totals as they stand right now, aggregated in SQL. Nothing ' +
      'here is cached or stored — the same derivation the members list and ' +
      'the door use, so the dashboard cannot report a different number of ' +
      'active members than the page it links to.\n\n' +
      'Everything is **branch-scoped** for a branch-scoped caller: their own ' +
      'members, their own door, their own till. At `all` scope it is the whole ' +
      'business.\n\n' +
      '“Today” is the **gym’s** day, reckoned in Africa/Addis_Ababa. A ' +
      'payment taken at 01:00 belongs to the shift that took it, not to ' +
      'yesterday, which is what a UTC truncation would say.',
  })
  @ApiOkResponse({ type: DashboardDto })
  dashboard(@CurrentUser() user: AuthenticatedUser) {
    return this.reportsService.dashboard(branchScopeOf(user));
  }
}

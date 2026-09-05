import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import { Permissions } from '../auth/decorators/permissions.decorator';
import {
  ApiBadRequestError,
  ApiNotFoundError,
} from '../common/api-errors.decorator';
import { ApiPaginatedResponse } from '../common/api-paginated-response.decorator';
import { PaginationDto } from '../common/pagination.dto';
import { JobTitleDto } from './dto/job-title-response.dto';
import { JobTitlesService } from './job-titles.service';

/**
 * READ ONLY. There is deliberately no POST or PATCH: the catalogue is code, in
 * database/job-titles.data.ts, applied by the seed. Adding a title is a commit
 * and a re-seed, exactly like adding a permission.
 */
@ApiTags('Job titles')
@Controller('job-titles')
export class JobTitlesController {
  constructor(private readonly jobTitlesService: JobTitlesService) {}

  @Permissions('jobTitle.list')
  @Get()
  @ApiOperation({
    summary: 'List job titles',
    description:
      'The fixed catalogue. `search` matches the name. Inactive titles are ' +
      'included so an existing staff member’s title still resolves.\n\n' +
      'Branch on `code`, never on `name` — the name is a label a gym may ' +
      'rename, the code never changes.',
  })
  @ApiPaginatedResponse(JobTitleDto)
  findAll(@Query() query: PaginationDto) {
    return this.jobTitlesService.findAll(query);
  }

  @Permissions('jobTitle.list')
  @Get(':id')
  @ApiOperation({ summary: 'Get one job title' })
  @ApiParam({ name: 'id', format: 'uuid', description: 'Job title id.' })
  @ApiOkResponse({ type: JobTitleDto })
  @ApiBadRequestError()
  @ApiNotFoundError('Job title not found')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.jobTitlesService.findOne(id);
  }
}

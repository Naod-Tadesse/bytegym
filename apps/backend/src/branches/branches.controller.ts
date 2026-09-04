import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';

import { Permissions } from '../auth/decorators/permissions.decorator';
import {
  ApiBadRequestError,
  ApiConflictError,
  ApiNotFoundError,
} from '../common/api-errors.decorator';
import { ApiPaginatedResponse } from '../common/api-paginated-response.decorator';
import { PaginationDto } from '../common/pagination.dto';
import { BranchesService } from './branches.service';
import { BranchDto } from './dto/branch-response.dto';
import { CreateBranchDto, UpdateBranchDto } from './dto/branch.dto';

/** Shared by every route taking a branch id. */
const BranchIdParam = () =>
  ApiParam({ name: 'id', format: 'uuid', description: 'Branch id.' });

@ApiTags('Branches')
@Controller('branches')
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Permissions('branch.list')
  @Get()
  @ApiOperation({
    summary: 'List branches',
    description:
      '`search` matches the branch name. Inactive branches are included.',
  })
  @ApiPaginatedResponse(BranchDto)
  findAll(@Query() query: PaginationDto) {
    return this.branchesService.findAll(query);
  }

  @Permissions('branch.list')
  @Get(':id')
  @ApiOperation({ summary: 'Get one branch' })
  @BranchIdParam()
  @ApiOkResponse({ type: BranchDto })
  @ApiBadRequestError()
  @ApiNotFoundError('Branch not found')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.branchesService.findOne(id);
  }

  @Permissions('branch.create')
  @Post()
  @ApiOperation({ summary: 'Create a branch' })
  @ApiCreatedResponse({ type: BranchDto })
  @ApiBadRequestError()
  @ApiConflictError('A branch with this name already exists')
  create(@Body() dto: CreateBranchDto) {
    return this.branchesService.create(dto);
  }

  @Permissions('branch.update')
  @Patch(':id')
  @ApiOperation({
    summary: 'Update a branch',
    description: 'Only the fields you send are changed.',
  })
  @BranchIdParam()
  @ApiOkResponse({ type: BranchDto })
  @ApiBadRequestError()
  @ApiNotFoundError('Branch not found')
  @ApiConflictError('A branch with this name already exists')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateBranchDto) {
    return this.branchesService.update(id, dto);
  }

  @Permissions('branch.update')
  @Delete(':id')
  @ApiOperation({
    summary: 'Deactivate a branch',
    description:
      'Not a delete: branches have no soft-delete column, so this flips ' +
      'isActive to false and returns the updated row, keeping staff history ' +
      'resolvable. Requires branch.update, not a delete permission.',
  })
  @BranchIdParam()
  @ApiOkResponse({ type: BranchDto, description: 'The deactivated branch.' })
  @ApiBadRequestError()
  @ApiNotFoundError('Branch not found')
  deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.branchesService.deactivate(id);
  }
}

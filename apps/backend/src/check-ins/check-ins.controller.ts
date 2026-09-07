import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Post,
  Query,
  Res,
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';

import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import {
  ApiBadRequestError,
  ApiNotFoundError,
} from '../common/api-errors.decorator';
import { ApiPaginatedResponse } from '../common/api-paginated-response.decorator';
import { branchScopeOf } from '../common/branch-scope';
import { CheckInsService } from './check-ins.service';
import { CheckInDto, CheckInRefusalDto } from './dto/check-in-response.dto';
import { CheckInQueryDto, RecordCheckInDto } from './dto/check-in.dto';

/**
 * The door. **Append-only** — no PATCH and no DELETE anywhere here, because
 * attendance is a record of what happened rather than a row describing a
 * current state, and a fact that can be edited is not evidence of anything.
 */
@ApiTags('Check-ins')
@Controller('check-ins')
export class CheckInsController {
  constructor(private readonly checkInsService: CheckInsService) {}

  @Permissions('checkin.list')
  @Get()
  @ApiOperation({
    summary: 'List a day’s check-ins',
    description:
      'One gym day’s attendance, newest first — the list a manager scans at ' +
      'the end of a shift.\n\n' +
      '`on` **defaults to today** in the gym’s own timezone and there is no ' +
      'way to ask for every day at once: the desk view is today, and an ' +
      'unfiltered list would page through every visit the gym has ever ' +
      'recorded.\n\n' +
      'Rows with an `overrideByName` are the ones worth looking at — someone ' +
      'was admitted with nothing covering the day.\n\n' +
      'A branch-scoped caller sees only their own branch. `search` is ' +
      'inherited from the shared pagination query and is ignored here.',
  })
  @ApiPaginatedResponse(CheckInDto)
  @ApiBadRequestError()
  @ApiNotFoundError('Member not found')
  findAll(
    @Query() query: CheckInQueryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.checkInsService.findAll(query, branchScopeOf(user));
  }

  // Above @Permissions on purpose. Decorators apply bottom-to-top, so this one
  // lands last and its `type` wins over the generic ErrorResponseDto that
  // @Permissions attaches to 403 — both descriptions are kept and merged.
  @ApiForbiddenResponse({
    type: CheckInRefusalDto,
    description:
      'The member may not train today. The body carries a stable `reason` ' +
      'beside the message — **branch on `reason`, never on the prose**:\n\n' +
      '| `reason` | Meaning | What the desk does |\n' +
      '| --- | --- | --- |\n' +
      '| `suspended` | Barred from the premises | Fetch a manager |\n' +
      '| `expired` | Nothing covers today | Sell a renewal |\n' +
      '| `upcoming` | Every period still ahead | They are early — do not ask for money |\n' +
      '| `none` | Never bought one | Sign them up |\n\n' +
      '`checkin.override` turns the last three into a 201 with a null ' +
      '`membershipId`. It does **not** lift `suspended`.\n\n' +
      'Also returned, with the generic body and no `reason`, when the caller ' +
      'lacks `checkin.record`.',
  })
  @Permissions('checkin.record')
  @Post()
  @ApiOperation({
    summary: 'Check a member in',
    description:
      'Admits a member, or refuses them and says why.\n\n' +
      '**A repeat scan is not an error.** Members leave for lunch and come ' +
      'back, and a 409 at the desk is a worse answer than none — it tells ' +
      'the person scanning neither that the member is in nor that they are ' +
      'not. So the endpoint returns today’s existing row instead, and the ' +
      'status says which happened: **201** a new check-in, **200** one that ' +
      'was already there. One check-in per member per gym day, enforced by a ' +
      'unique index rather than by the look-up, so two turnstiles scanning at ' +
      'once still produce one row.\n\n' +
      'Everything but `memberId` is decided by the server: the branch is the ' +
      '**member’s** home gym, the day is the gym’s own date, the recorder ' +
      'comes from the access token, and `membershipId` is whichever ' +
      'membership actually covers the day — null when the member was let ' +
      'through on an override.\n\n' +
      '404s when the member is not at the caller’s branch.',
  })
  @ApiCreatedResponse({
    type: CheckInDto,
    description: 'Checked in. This is the first scan of the gym day.',
  })
  @ApiOkResponse({
    type: CheckInDto,
    description:
      'Already checked in today — this is the existing row, unchanged. Tell ' +
      'the member the scan registered and that it was not new.',
  })
  @ApiBadRequestError()
  @ApiNotFoundError('Member not found')
  async record(
    @Body() dto: RecordCheckInDto,
    @CurrentUser() user: AuthenticatedUser,
    // The one place in this API that takes the response object. A POST's status
    // is otherwise fixed at declaration time by @HttpCode, and this route has
    // to choose 201 or 200 per request. `passthrough: true` would NOT work:
    // Nest still calls reply() afterwards with the route's declared status and
    // overwrites whatever the handler set.
    @Res() response: Response,
  ) {
    const { created, row } = await this.checkInsService.record(dto, user);

    // Nothing may be returned from here — with @Res() Nest hands the response
    // over entirely and logs a warning if a handler returns a value anyway.
    response.status(created ? HttpStatus.CREATED : HttpStatus.OK).json(row);
  }
}

import { Body, Controller, Get, Patch, Post, Query } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Permissions } from '../auth/decorators/permissions.decorator';
import { ApiBadRequestError } from '../common/api-errors.decorator';
import { ApiPaginatedResponse } from '../common/api-paginated-response.decorator';
import { branchScopeOf } from '../common/branch-scope';
import {
  BroadcastDto,
  SendSmsDto,
  SmsQueryDto,
  UpdateSmsSettingsDto,
} from './dto/sms.dto';
import {
  BroadcastResultDto,
  ReminderRunDto,
  SmsMessageDto,
  SmsRecipientCountDto,
  SmsSettingsDto,
} from './dto/sms-response.dto';
import { SmsMessagesService } from './sms-messages.service';

/**
 * Messaging. Four permissions rather than one, because these are four
 * different sizes of mistake — see `permissions.data.ts`.
 */
@ApiTags('SMS')
@Controller('sms')
export class SmsController {
  constructor(private readonly smsMessages: SmsMessagesService) {}

  @Permissions('sms.list')
  @Get()
  @ApiOperation({
    summary: 'What has been sent',
    description:
      'Newest first, and **nothing is filtered out**: held and failed ' +
      'messages are listed beside successful ones, because the only question ' +
      'anyone asks this log is “did we tell them?” and a success-only list ' +
      'cannot answer it.\n\n' +
      '`search` matches the number or the message body.',
  })
  @ApiPaginatedResponse(SmsMessageDto)
  @ApiBadRequestError()
  findAll(@Query() query: SmsQueryDto) {
    return this.smsMessages.findAll(query);
  }

  @Permissions('sms.send')
  @Post('send')
  @ApiOperation({
    summary: 'Text one number',
    description:
      'A new year wish, a note to somebody who left their bag — anything ' +
      'typed by hand.\n\n' +
      'The number does **not** have to belong to a member. When it does, the ' +
      'log records who it was; when it does not, the row still exists with ' +
      'the number alone, because texting a prospective member is a real thing ' +
      'a gym does.\n\n' +
      'Always 201, even when the message did not go out. The result says ' +
      'which of `sent`, `held` or `failed` it was — a failed send is an ' +
      'outcome to be shown, not an error to be thrown at the front desk.',
  })
  @ApiCreatedResponse({ type: SmsMessageDto })
  @ApiBadRequestError('The phone number or message failed validation.')
  send(@Body() dto: SendSmsDto, @CurrentUser() user: AuthenticatedUser) {
    return this.smsMessages.send(dto, user.staffId);
  }

  @Permissions('sms.broadcast')
  @Post('broadcast')
  @ApiOperation({
    summary: 'Text every member, or every member on one plan',
    description:
      '`{{name}}` is replaced with each member’s first name.\n\n' +
      '**Returns as soon as the recipients are counted, not when the last ' +
      'message goes out.** A thousand members takes minutes, and a ' +
      'receptionist holding a request open that long will refresh and send ' +
      'the whole thing twice. Watch the log for the outcome.\n\n' +
      'A branch-scoped caller reaches their own branch’s members only.',
  })
  @ApiCreatedResponse({ type: BroadcastResultDto })
  @ApiBadRequestError()
  broadcast(@Body() dto: BroadcastDto, @CurrentUser() user: AuthenticatedUser) {
    return this.smsMessages.broadcast(dto, user.staffId, branchScopeOf(user));
  }

  @Permissions('sms.broadcast')
  @Post('broadcast/preview')
  @ApiOperation({
    summary: 'How many a broadcast would reach',
    description:
      'Counts the recipients and sends nothing. The number is the whole ' +
      'point of a confirmation step: “this will text 412 people” is the only ' +
      'thing that stops the wrong audience being chosen.',
  })
  @ApiOkResponse({ type: SmsRecipientCountDto })
  @ApiBadRequestError()
  async preview(
    @Body() dto: BroadcastDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const recipients = await this.smsMessages.recipients(
      dto,
      branchScopeOf(user),
    );
    return { recipients: recipients.length };
  }

  @Permissions('sms.settings')
  @Get('settings')
  @ApiOperation({
    summary: 'The automatic reminder settings',
    description:
      'One row for the whole gym. Created on first read, so this never 404s.',
  })
  @ApiOkResponse({ type: SmsSettingsDto })
  getSettings() {
    return this.smsMessages.getSettings();
  }

  @Permissions('sms.settings')
  @Patch('settings')
  @ApiOperation({
    summary: 'Change the automatic reminder settings',
    description:
      'From `reminderDaysBefore` days out, every member whose membership is ' +
      'still running is texted **once a day, every day, until it lapses**. ' +
      'That means the number is also the cost: seven days is seven messages ' +
      'per member.\n\n' +
      'A member is reminded at most once per gym day whatever happens — the ' +
      'database enforces it with a partial unique index, not a check in code, ' +
      'so a restart or a second instance cannot double up.',
  })
  @ApiOkResponse({ type: SmsSettingsDto })
  @ApiBadRequestError('reminderDaysBefore must be between 1 and 365.')
  updateSettings(
    @Body() dto: UpdateSmsSettingsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.smsMessages.updateSettings(dto, user.staffId);
  }

  @Permissions('sms.settings')
  @Post('reminders/run')
  @ApiOperation({
    summary: 'Run the reminder job now',
    description:
      'The same run the scheduler makes at 09:00 gym time, triggered by ' +
      'hand. It exists because the alternative way to test a daily cron is to ' +
      'wait a day.\n\n' +
      'Safe to call repeatedly: anyone already reminded today is skipped by ' +
      'the database, and comes back in `skipped` rather than being texted ' +
      'again.',
  })
  @ApiCreatedResponse({ type: ReminderRunDto })
  runReminders() {
    return this.smsMessages.sendDueReminders();
  }
}

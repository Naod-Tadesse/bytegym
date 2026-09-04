import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public } from '../auth/decorators/public.decorator';
import { AppService } from './app.service';
import { MessageDto } from './dto/message.dto';

@ApiTags('Health')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get()
  @ApiOperation({
    summary: 'Service banner',
    description: 'Unauthenticated. Confirms the API is reachable behind /api.',
  })
  @ApiOkResponse({ type: MessageDto })
  getData() {
    return this.appService.getData();
  }
}

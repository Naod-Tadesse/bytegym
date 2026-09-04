import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
} from '@nestjs/common';
import {
  ApiBody,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { ErrorResponseDto } from '../common/error-response.dto';
import { ApiBadRequestError } from '../common/api-errors.decorator';
import { AuthService } from './auth.service';
import type { AuthenticatedUser } from './auth.types';
import { Authenticated } from './decorators/authenticated.decorator';
import { CurrentUser } from './decorators/current-user.decorator';
import { Public } from './decorators/public.decorator';
import { CurrentUserDto, TokenPairDto } from './dto/auth-response.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { LogoutDto } from './dto/logout.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Sign in with phone and password',
    description:
      'Returns an access/refresh pair. 200 rather than 201 — nothing is created.',
  })
  @ApiOkResponse({ type: TokenPairDto })
  @ApiBadRequestError()
  @ApiUnauthorizedResponse({
    description:
      'One of: `Invalid credentials` (unknown phone or wrong password — the ' +
      'same message for both, so accounts cannot be enumerated), `This ' +
      'account is not active`, or `This account cannot sign in` (no staff ' +
      'profile, or terminated).',
    type: ErrorResponseDto,
  })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Exchange a refresh token for a new pair',
    description:
      'Rotates the refresh token. The old one is spent immediately, so a ' +
      'client must store the new pair before the next call.',
  })
  @ApiOkResponse({ type: TokenPairDto })
  @ApiBadRequestError()
  @ApiUnauthorizedResponse({
    description:
      'Expired, unknown or already-spent token. A replay is treated as theft ' +
      'and revokes every session for that user.',
    type: ErrorResponseDto,
  })
  refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Authenticated()
  @ApiOperation({
    summary: 'Revoke this session, or every session',
    description:
      'Send the refresh token to sign out only that device; send an empty ' +
      'body to sign out everywhere.',
  })
  // The body is genuinely optional — an absent one parses to {}.
  @ApiBody({ type: LogoutDto, required: false })
  @ApiNoContentResponse({ description: 'Session(s) revoked.' })
  async logout(@CurrentUser() user: AuthenticatedUser, @Body() dto: LogoutDto) {
    await this.authService.logout(user.userId, dto?.refreshToken);
  }

  @Get('me')
  @Authenticated()
  @ApiOperation({
    summary: 'The signed-in staff member',
    description:
      'Roles and permissions are read from the database on every call, not ' +
      'echoed from the token, so a revoked grant disappears immediately.',
  })
  @ApiOkResponse({ type: CurrentUserDto })
  me(@CurrentUser() user: AuthenticatedUser) {
    return this.authService.me(user);
  }

  @Patch('change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @Authenticated()
  @ApiOperation({ summary: 'Change your own password' })
  @ApiNoContentResponse({
    description:
      'Password changed. Every session is revoked, this one included — the ' +
      'current access token works until it expires, but the refresh token is ' +
      'already dead, so the client must sign in again.',
  })
  @ApiBadRequestError()
  @ApiUnauthorizedResponse({
    description: 'currentPassword did not match.',
    type: ErrorResponseDto,
  })
  async changePassword(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.authService.changePassword(user, dto);
  }
}

import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

/**
 * A real class rather than `Partial<RefreshTokenDto>`: a mapped type reflects
 * as `Object`, which ValidationPipe skips entirely and Swagger cannot see —
 * so that body went completely unvalidated, `whitelist` included.
 */
export class LogoutDto {
  @ApiPropertyOptional({
    type: String,
    description:
      'Omit to revoke every session for this user; supply it to sign out ' +
      'only the device holding that token.',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  refreshToken?: string;
}

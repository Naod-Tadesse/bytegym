import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenDto {
  @ApiProperty({
    type: String,
    description:
      'The refresh token from the last login or refresh. Single-use — each ' +
      'call rotates it, and replaying a spent one revokes every session for ' +
      'that user.',
  })
  @IsString()
  @IsNotEmpty()
  refreshToken!: string;
}

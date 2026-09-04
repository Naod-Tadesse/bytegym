import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ type: String, minLength: 6 })
  @IsString()
  @MinLength(6)
  currentPassword!: string;

  // Longer than currentPassword on purpose: existing accounts may predate the
  // 8-character rule, but nothing new may.
  @ApiProperty({ type: String, minLength: 8 })
  @IsString()
  @MinLength(8)
  newPassword!: string;
}

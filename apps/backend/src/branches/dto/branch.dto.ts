import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateBranchDto {
  @ApiProperty({ type: String, maxLength: 120, example: 'Bole' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({
    type: String,
    maxLength: 255,
    example: 'Africa Avenue, near Friendship Centre',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  addressLine?: string;

  @ApiPropertyOptional({ type: String, maxLength: 80, example: 'Addis Ababa' })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @ApiPropertyOptional({
    type: String,
    maxLength: 30,
    example: '0116000000',
    // Deliberately looser than the staff/login phone rule: a branch may list a
    // landline or a switchboard, not a mobile.
    description: 'Free-form contact number — no format is enforced.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;
}

export class UpdateBranchDto {
  @ApiPropertyOptional({ type: String, maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  name?: string;

  @ApiPropertyOptional({ type: String, maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  addressLine?: string;

  @ApiPropertyOptional({ type: String, maxLength: 80 })
  @IsOptional()
  @IsString()
  @MaxLength(80)
  city?: string;

  @ApiPropertyOptional({ type: String, maxLength: 30 })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @ApiPropertyOptional({
    type: Boolean,
    description:
      'Set false to retire the branch without deleting it. Also what ' +
      'DELETE /branches/{id} does.',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

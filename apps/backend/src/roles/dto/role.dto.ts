import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateRoleDto {
  @ApiProperty({
    type: String,
    maxLength: 255,
    example: 'Receptionist',
    description: 'Compared case-insensitively — "Owner" and "owner" collide.',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional({
    type: String,
    maxLength: 500,
    example: 'Works the front desk: checks members in and takes payments',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}

export class UpdateRoleDto {
  @ApiPropertyOptional({ type: String, maxLength: 255 })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional({ type: String, maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    type: Boolean,
    description:
      'An inactive role keeps its grants but is not offered when assigning ' +
      'roles to staff.',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class SyncRolePermissionsDto {
  @ApiProperty({
    // The explicit schema form, not `type: [String] + format` — the latter
    // puts the format on the array rather than on its items.
    type: 'array',
    items: { type: 'string', format: 'uuid' },
    description:
      'The complete desired set. This is a replace, not an append: any ' +
      'currently-granted permission missing from this array is revoked.',
  })
  @IsArray()
  @IsUUID('4', { each: true })
  permissionIds!: string[];
}

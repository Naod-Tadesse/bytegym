import { ApiProperty } from '@nestjs/swagger';

/** The full permissions row, as returned by GET /permissions. */
export class PermissionDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({
    type: String,
    example: 'member.create',
    description: 'The key checked in code and named in 403 responses.',
  })
  name!: string;

  @ApiProperty({ type: String, example: 'Create members' })
  displayName!: string;

  @ApiProperty({ type: String, nullable: true })
  description!: string | null;

  @ApiProperty({
    type: String,
    example: 'Members',
    description: 'How the admin UI buckets this permission.',
  })
  group!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;
}

/**
 * The projection nested inside GET /roles/{id} — deliberately narrower than
 * PermissionDto: the service selects five columns and omits createdAt.
 */
export class RolePermissionDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, example: 'member.create' })
  name!: string;

  @ApiProperty({ type: String, example: 'Create members' })
  displayName!: string;

  @ApiProperty({ type: String, nullable: true })
  description!: string | null;

  @ApiProperty({ type: String, example: 'Members' })
  group!: string;
}

export class RoleDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, example: 'Receptionist' })
  name!: string;

  @ApiProperty({ type: String, nullable: true })
  description!: string | null;

  @ApiProperty({ type: Boolean })
  isActive!: boolean;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description:
      'Soft-delete stamp. Present because the service selects the whole row; ' +
      'null on every role a list can return, non-null only on the row handed ' +
      'back by DELETE /roles/{id}.',
  })
  deletedAt!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;
}

export class RoleDetailDto extends RoleDto {
  @ApiProperty({ type: [RolePermissionDto] })
  permissions!: RolePermissionDto[];
}

export class SyncPermissionsResultDto {
  @ApiProperty({ type: Number, example: 3 })
  added!: number;

  @ApiProperty({ type: Number, example: 1 })
  removed!: number;
}

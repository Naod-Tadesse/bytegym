import { ApiProperty } from '@nestjs/swagger';

/**
 * Mirrors `select()` on the branches table. Nullable columns are declared
 * `nullable: true`, not optional — the key is always present, carrying null.
 */
export class BranchDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({ type: String, example: 'Bole' })
  name!: string;

  @ApiProperty({
    type: String,
    nullable: true,
    example: 'Africa Avenue, near Friendship Centre',
  })
  addressLine!: string | null;

  @ApiProperty({ type: String, nullable: true, example: 'Addis Ababa' })
  city!: string | null;

  @ApiProperty({ type: String, nullable: true, example: '0116000000' })
  phone!: string | null;

  @ApiProperty({
    type: Boolean,
    description: 'Branches are retired by flipping this, never hard-deleted.',
  })
  isActive!: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;
}

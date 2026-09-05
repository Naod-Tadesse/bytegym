import { ApiProperty } from '@nestjs/swagger';

/**
 * Documentation only — nothing binds this to what the service selects, so
 * change both together.
 */
export class JobTitleDto {
  @ApiProperty({ type: String, format: 'uuid' })
  id!: string;

  @ApiProperty({
    type: String,
    maxLength: 40,
    example: 'receptionist',
    description:
      'Stable identifier. Branch on THIS, never on `name` — the name is a ' +
      'label a gym may rename, the code never changes.',
  })
  code!: string;

  @ApiProperty({
    type: String,
    maxLength: 80,
    example: 'Receptionist',
    description: 'Display label only. Nothing branches on it.',
  })
  name!: string;

  @ApiProperty({
    type: Boolean,
    description:
      'Whether someone with this title may hold a login. Enforced by the API ' +
      'on staff creation and on granting access, not merely hinted in the UI.',
  })
  canHaveAccount!: boolean;

  @ApiProperty({ type: Boolean })
  isActive!: boolean;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;
}

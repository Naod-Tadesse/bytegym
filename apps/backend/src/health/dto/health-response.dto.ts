import { ApiProperty } from '@nestjs/swagger';

export class HealthCheckDto {
  @ApiProperty({ type: String, example: 'ok' })
  status!: string;

  @ApiProperty({
    type: String,
    example: 'up',
    description: 'Only ever "up" — the probe throws if `select 1` fails.',
  })
  database!: string;

  @ApiProperty({
    type: Number,
    example: 2,
    description: 'Row count in users, proving the connection really queried.',
  })
  users!: number;
}

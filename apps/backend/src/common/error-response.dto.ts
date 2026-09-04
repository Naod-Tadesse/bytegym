import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Nest's default exception body. There is no global exception filter
 * normalising these, so `message` genuinely has two shapes: ValidationPipe
 * returns an array of constraint messages, while every hand-thrown
 * HttpException — and ParseUUIDPipe — returns a single string. The `oneOf`
 * says so rather than lying in either direction.
 */
export class ErrorResponseDto {
  @ApiProperty({ example: 400 })
  statusCode!: number;

  @ApiProperty({
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
    example: 'Branch not found',
  })
  message!: string | string[];

  @ApiPropertyOptional({ example: 'Bad Request' })
  error?: string;
}

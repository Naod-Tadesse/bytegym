import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class PaginationDto {
  /** `@Type` matters: query strings arrive as text, this coerces `?page=2`. */
  @ApiPropertyOptional({ type: Number, minimum: 1, default: 1, example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    type: Number,
    minimum: 1,
    maximum: 100,
    default: 10,
    example: 10,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @ApiPropertyOptional({
    type: String,
    description:
      'Case-insensitive substring match. Which columns are searched differs ' +
      'per endpoint — see each operation description.',
  })
  @IsOptional()
  @IsString()
  search?: string;
}

export class PaginationMetaDto {
  @ApiProperty({
    example: 42,
    description:
      'Rows matching the filter across every page, not just this one.',
  })
  total!: number;

  @ApiProperty({ example: 1 })
  page!: number;

  @ApiProperty({ example: 10 })
  limit!: number;

  @ApiProperty({
    example: 5,
    description: 'Never 0 — an empty list is still page 1 of 1.',
  })
  totalPages!: number;
}

/**
 * Only `meta` is declared here. `data` is contributed by the allOf branch in
 * `ApiPaginatedResponse`, so the item type stays a single unambiguous $ref
 * rather than a second `object` schema merged on top of it.
 */
export abstract class PaginatedDto {
  @ApiProperty({ type: PaginationMetaDto })
  meta!: PaginationMetaDto;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

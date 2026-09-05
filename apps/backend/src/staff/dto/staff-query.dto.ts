import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

import { PaginationDto } from '../../common/pagination.dto';

export class StaffQueryDto extends PaginationDto {
  /**
   * Splits the roster from the system users: the Staff screen lists everyone,
   * the Users screen passes `true` to list only the people who can sign in.
   *
   * Reads `obj`, the RAW query object, not `value`. The global ValidationPipe
   * sets `enableImplicitConversion`, which coerces to the declared type with
   * `Boolean(value)` — and `Boolean('false')` is `true`, so by the time
   * `value` arrives every string has already collapsed to true. `obj` is the
   * untouched source, which is the only place the real answer survives.
   */
  @ApiPropertyOptional({
    type: Boolean,
    description:
      'Filter by whether they have a login. `true` lists only staff with an ' +
      'account (the system users), `false` only those without. Omit for all.',
  })
  @IsOptional()
  @Transform(({ obj }) => {
    const raw = (obj as Record<string, unknown>)['hasAccount'];
    if (raw === undefined || raw === '') return undefined;
    return raw === 'true' || raw === true;
  })
  @IsBoolean()
  hasAccount?: boolean;
}

import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsOptional } from 'class-validator';

import { PaginationDto } from '../../common/pagination.dto';

export class MembershipPlanQueryDto extends PaginationDto {
  /**
   * Splits the catalogue from what is sellable: the Plans screen lists
   * everything, the sell-membership picker passes `true`. Selling a retired
   * plan is refused by the API, so the picker must not offer one.
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
      'Filter by whether the plan is sellable. `true` lists only active ' +
      'plans — what a sell form wants. Omit for the whole catalogue.',
  })
  @IsOptional()
  @Transform(({ obj }) => {
    const raw = (obj as Record<string, unknown>)['isActive'];
    if (raw === undefined || raw === '') return undefined;
    return raw === 'true' || raw === true;
  })
  @IsBoolean()
  isActive?: boolean;
}

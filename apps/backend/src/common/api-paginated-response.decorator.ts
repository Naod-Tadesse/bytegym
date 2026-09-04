import { applyDecorators, type Type } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger';

import { PaginatedDto } from './pagination.dto';

/**
 * Documents the `{ data: Model[], meta }` envelope every list endpoint returns,
 * without needing a wrapper class per model — OpenAPI has no generics.
 *
 * `data` is declared in the allOf branch rather than on `PaginatedDto` so the
 * generated schema carries one unambiguous $ref for the item type.
 */
export const ApiPaginatedResponse = <TModel extends Type<unknown>>(
  model: TModel,
  options: { description?: string } = {},
) =>
  applyDecorators(
    // Neither class is reachable from a typed @ApiProperty, so both have to be
    // registered by hand or the $refs dangle.
    ApiExtraModels(PaginatedDto, model),
    ApiOkResponse({
      description: options.description ?? `Paginated ${model.name} list.`,
      schema: {
        allOf: [
          { $ref: getSchemaPath(PaginatedDto) },
          {
            required: ['data'],
            properties: {
              data: { type: 'array', items: { $ref: getSchemaPath(model) } },
            },
          },
        ],
      },
    }),
  );

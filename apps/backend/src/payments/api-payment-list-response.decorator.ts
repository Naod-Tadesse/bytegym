import { applyDecorators } from '@nestjs/common';
import { ApiExtraModels, ApiOkResponse, getSchemaPath } from '@nestjs/swagger';

import { PaginatedDto } from '../common/pagination.dto';
import { PaymentDto, PaymentTotalsDto } from './dto/payment-response.dto';

/**
 * `ApiPaginatedResponse` with one extra key.
 *
 * Payments are the only list that carries anything beside `data` and `meta`,
 * so this stays here rather than generalising the shared decorator: the shift
 * total is specific to money, and a `totals` parameter on every list would
 * invite one that means something different per endpoint.
 */
export const ApiPaymentListResponse = () =>
  applyDecorators(
    // None of these is reachable from a typed @ApiProperty, so all three have
    // to be registered by hand or the $refs dangle.
    ApiExtraModels(PaginatedDto, PaymentDto, PaymentTotalsDto),
    ApiOkResponse({
      description:
        'Paginated payments, newest first, plus the shift total. Voided ' +
        'payments are included — `totals.received` excludes them.',
      schema: {
        allOf: [
          { $ref: getSchemaPath(PaginatedDto) },
          {
            required: ['data', 'totals'],
            properties: {
              data: {
                type: 'array',
                items: { $ref: getSchemaPath(PaymentDto) },
              },
              totals: { $ref: getSchemaPath(PaymentTotalsDto) },
            },
          },
        ],
      },
    }),
  );

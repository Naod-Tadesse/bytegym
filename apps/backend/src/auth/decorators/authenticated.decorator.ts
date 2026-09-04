import { applyDecorators } from '@nestjs/common';
import { ApiBearerAuth, ApiUnauthorizedResponse } from '@nestjs/swagger';

import { ErrorResponseDto } from '../../common/error-response.dto';

/**
 * Documentation only — it sets no metadata and changes no behaviour.
 *
 * The global JwtAuthGuard secures everything not marked @Public(), but only
 * @Permissions() carries the matching OpenAPI decorators. A route that is
 * authenticated yet needs no particular permission would otherwise render as
 * public in the spec. Put this on those routes.
 */
export const Authenticated = () =>
  applyDecorators(
    ApiBearerAuth(),
    ApiUnauthorizedResponse({
      description: 'Missing, expired or malformed access token.',
      type: ErrorResponseDto,
    }),
  );

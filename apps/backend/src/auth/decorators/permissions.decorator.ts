import { applyDecorators, SetMetadata } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

import { ErrorResponseDto } from '../../common/error-response.dto';

export const PERMISSIONS_KEY = 'permissions';

/**
 * Requires every listed permission. A route with no @Permissions() is
 * authenticated-only — see PermissionsGuard.
 *
 * It also carries the OpenAPI consequences of the two global guards, so the
 * docs cannot drift from the rule they describe: name a permission here and
 * the 403 in the spec names the same one.
 *
 * `applyDecorators` discards each decorator's return value, but SetMetadata's
 * method form calls Reflect.defineMetadata on the descriptor in place — so
 * PermissionsGuard's `Reflector.getAllAndOverride` is unaffected.
 */
export const Permissions = (...permissions: string[]) =>
  applyDecorators(
    SetMetadata(PERMISSIONS_KEY, permissions),
    // Bare on purpose: this and DocumentBuilder.addBearerAuth() both default to
    // the scheme name 'bearer'. Rename one, rename both.
    ApiBearerAuth(),
    ApiUnauthorizedResponse({
      description: 'Missing, expired or malformed access token.',
      type: ErrorResponseDto,
    }),
    ApiForbiddenResponse({
      description: `Requires: ${permissions.join(', ')}`,
      type: ErrorResponseDto,
    }),
  );

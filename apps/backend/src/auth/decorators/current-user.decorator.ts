import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

import type { AuthenticatedUser } from '../auth.types';

/**
 * Reads the user Passport put on the request from JwtStrategy.validate().
 * Identity always comes from the token, never from the request body.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    return context.switchToHttp().getRequest().user;
  },
);

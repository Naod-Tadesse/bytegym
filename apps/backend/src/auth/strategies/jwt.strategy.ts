import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

import type { AuthenticatedUser, JwtPayload } from '../auth.types';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  /** Whatever this returns becomes request.user. */
  validate(payload: JwtPayload): AuthenticatedUser {
    return {
      personId: payload.sub,
      staffId: payload.staffId,
      accountId: payload.accountId,
      branchId: payload.branchId,
      // A token minted before data_scope existed has neither claim; treat it
      // as the narrower scope rather than handing it the whole gym.
      dataScope: payload.dataScope ?? 'branch',
      permissions: payload.permissions ?? [],
    };
  }
}

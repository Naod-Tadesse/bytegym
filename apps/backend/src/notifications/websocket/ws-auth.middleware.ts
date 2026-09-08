import { Logger } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import type { Socket } from 'socket.io';

import type { AuthenticatedUser, JwtPayload } from '../../auth/auth.types';

/** A socket that has been through the middleware below. */
export interface AuthenticatedSocket extends Socket {
  user: AuthenticatedUser;
}

/** Everyone who is signed in as staff, whatever their branch. */
export const ALL_STAFF_ROOM = 'staff';

/** Everyone at one branch. `branchScopeOf`, expressed as a socket.io room. */
export const branchRoom = (branchId: string) => `branch:${branchId}`;

/** Everyone whose data scope is `all` — they see every branch's events. */
export const ALL_SCOPE_ROOM = 'scope:all';

/**
 * Authenticates the connection itself, as socket.io middleware, and **not** as
 * a Nest guard.
 *
 * A guard runs per *message*, which is too late: an unauthenticated client is
 * already connected, already holding a socket, and already able to sit there
 * costing memory. Middleware runs during the handshake, so `next(error)` means
 * the connection is never established at all.
 *
 * The token is read from `handshake.auth.token` — the socket.io client's own
 * field for this — rather than a query string, which would put a bearer token
 * in every proxy and access log along the way.
 *
 * **Verified with `JWT_SECRET`, the staff secret, and only that.** Member
 * tokens are signed with `JWT_APP_SECRET`, so a member's token fails
 * *verification* here rather than merely failing to match a permission. That is
 * the whole point of the two-secret design: this gateway pushes staff-facing
 * traffic — who walked in, what was taken at the till — and a member must not
 * be one forgotten check away from it.
 *
 * On expiry: the connection is authenticated once, at the handshake, and then
 * trusted for its lifetime. A 15-minute access token would otherwise sever a
 * dashboard someone leaves open all day. The client reconnects with a fresh
 * token when the socket drops, which is when the check runs again.
 */
export function wsAuthMiddleware(jwt: JwtService, secret: string) {
  const logger = new Logger('NotificationsGateway');

  return async (socket: Socket, next: (error?: Error) => void) => {
    const token = tokenFrom(socket);

    if (!token) {
      next(new Error('Unauthorized'));
      return;
    }

    try {
      const payload = await jwt.verifyAsync<JwtPayload>(token, { secret });

      const user: AuthenticatedUser = {
        personId: payload.sub,
        staffId: payload.staffId,
        accountId: payload.accountId,
        branchId: payload.branchId,
        // Same defensive default as JwtStrategy: a token minted before
        // `dataScope` existed gets the narrower scope, never the whole gym.
        dataScope: payload.dataScope ?? 'branch',
        permissions: payload.permissions ?? [],
      };

      (socket as AuthenticatedSocket).user = user;

      // Rooms are decided here, once, from the token — never from anything the
      // client sends. A client that could ask to join `branch:<someone else>`
      // would make the whole scope model advisory.
      await socket.join(ALL_STAFF_ROOM);
      await socket.join(branchRoom(user.branchId));
      if (user.dataScope === 'all') {
        await socket.join(ALL_SCOPE_ROOM);
      }

      next();
    } catch {
      // Deliberately no detail: "expired" and "wrong signature" are the same
      // answer to anyone probing, and the client's only useful response to
      // either is to refresh and reconnect.
      logger.debug('Rejected a connection with an unusable token');
      next(new Error('Unauthorized'));
    }
  };
}

/**
 * `auth.token` is where the socket.io client puts it. The Authorization header
 * is accepted too, because a non-browser client — a turnstile, a kiosk — may
 * only be able to set headers.
 */
function tokenFrom(socket: Socket): string | undefined {
  const fromAuth = socket.handshake.auth?.['token'];
  if (typeof fromAuth === 'string' && fromAuth.length > 0) return fromAuth;

  const header = socket.handshake.headers.authorization;
  if (typeof header === 'string' && header.startsWith('Bearer ')) {
    return header.slice('Bearer '.length);
  }

  return undefined;
}

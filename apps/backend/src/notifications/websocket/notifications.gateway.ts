import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Namespace, Socket } from 'socket.io';

import type {
  NotificationEvent,
  NotificationPayload,
} from '../notification-events';
import {
  ALL_SCOPE_ROOM,
  ALL_STAFF_ROOM,
  branchRoom,
  wsAuthMiddleware,
  type AuthenticatedSocket,
} from './ws-auth.middleware';

/**
 * The same allowlist `main.ts` gives the REST API.
 *
 * Read from the environment at module load because `@WebSocketGateway`'s
 * options are fixed when the decorator runs — there is no ConfigService yet.
 * It must stay an allowlist: a socket handshake is an ordinary HTTP request,
 * and reflecting any origin would let a page anywhere open an authenticated
 * connection with a token it had got hold of.
 */
const CORS_ORIGINS = (
  process.env.CORS_ORIGINS ?? 'http://localhost:4200'
).split(',');

/**
 * The staff-facing socket.
 *
 * Mounted on its own namespace so the path names its audience: a member app,
 * when it arrives, gets `/ws/app` and its own secret, and neither can reach the
 * other by forgetting a check.
 *
 * **There is no `@SubscribeMessage` here, and that is the design.** This is a
 * one-way push — the server tells connected desks that something changed, and
 * they refetch over REST, where branch scope and permissions are already
 * enforced. Accepting commands over a socket would mean a second authorisation
 * surface with none of that behind it.
 */
@WebSocketGateway({
  namespace: '/ws/staff',
  cors: { origin: CORS_ORIGINS, credentials: true },
})
export class NotificationsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(NotificationsGateway.name);

  // A `Namespace`, not a `Server`: with `namespace` set on the decorator that
  // is what Nest injects, and the two differ — `Server.sockets` is a namespace
  // while `Namespace.sockets` is the map of connected clients.
  @WebSocketServer()
  private readonly namespace!: Namespace;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Authentication is installed here rather than as a guard, because a guard
   * runs per message — by which point an unauthenticated client is already
   * connected. See `wsAuthMiddleware`.
   */
  afterInit(namespace: Namespace) {
    namespace.use(
      wsAuthMiddleware(this.jwt, this.config.getOrThrow<string>('JWT_SECRET')),
    );
  }

  handleConnection(client: Socket) {
    const { user } = client as AuthenticatedSocket;
    // `user` is always set: the middleware rejects the handshake otherwise, so
    // an unauthenticated socket never reaches this method.
    this.logger.debug(`Staff ${user.staffId} connected (${client.id})`);
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Socket ${client.id} disconnected`);
  }

  /**
   * Push an event to the desks that should see it.
   *
   * Addressed by room, and the rooms come from the token — so a branch-scoped
   * receptionist sees their own branch's door and till, and nobody else's.
   * `scope: all` users are in a room of their own that every event also goes
   * to; socket.io delivers once per socket even when two of its rooms match,
   * so an owner based at the branch does not get doubles.
   *
   * `branchId` omitted means every signed-in staff member, whatever their
   * branch — for things that are not about one gym.
   */
  emitToBranch(
    event: NotificationEvent,
    payload: NotificationPayload,
    branchId?: string,
  ) {
    const rooms = branchId
      ? [branchRoom(branchId), ALL_SCOPE_ROOM]
      : [ALL_STAFF_ROOM];

    this.namespace.to(rooms).emit(event, payload);
  }

  /** How many desks are listening. Only for logging and health. */
  get connectionCount(): number {
    return this.namespace?.sockets?.size ?? 0;
  }
}

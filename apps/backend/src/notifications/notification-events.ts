/**
 * Every event this server pushes, as a closed set.
 *
 * A closed union rather than free strings for the same reason
 * `CheckInRefusalReason` is one: **the frontend must branch on a code, never on
 * prose**. A typo in an event name is a listener that silently never fires,
 * with nothing to show for it at either end.
 *
 * Payloads are deliberately thin — an id and enough to render one line. The
 * socket says *something happened*; the client refetches through the ordinary
 * REST endpoints, which already apply branch scope and permissions. Pushing
 * whole records down a socket would mean re-implementing that authorisation a
 * second time, in the one place where getting it wrong is least visible.
 */
export const NOTIFICATION_EVENTS = {
  /** Somebody came through the door. The desk's live list grows a row. */
  CHECK_IN_RECORDED: 'check-in.recorded',
  /** A membership was sold. Dashboard counts and the member's row are stale. */
  MEMBERSHIP_SOLD: 'membership.sold',
  /** Money was taken. The shift total is stale. */
  PAYMENT_RECORDED: 'payment.recorded',
  /** A member was registered. */
  MEMBER_REGISTERED: 'member.registered',
} as const;

export type NotificationEvent =
  (typeof NOTIFICATION_EVENTS)[keyof typeof NOTIFICATION_EVENTS];

/**
 * What rides along with an event.
 *
 * `branchId` is not in here: it is not payload, it is the address. See
 * `NotificationsService.broadcast`, which takes it separately and uses it to
 * decide who the event reaches at all.
 */
export interface NotificationPayload {
  /** The row this is about, so a client can refetch just that one. */
  id?: string;
  /** One line, already readable, for a toast. Never authoritative. */
  summary?: string;
  /** When the server emitted it, ISO 8601. Clients must not trust their own clock. */
  at: string;
}

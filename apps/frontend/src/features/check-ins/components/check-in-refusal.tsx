import { useTranslation } from 'react-i18next';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Alert02Icon,
  AlertCircleIcon,
  Calendar03Icon,
  MinusSignCircleIcon,
} from '@hugeicons/core-free-icons';

import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/format';
import type { MemberListItem } from '@/features/members/data/types';
import type { CheckInRefusalReason } from '../data/types';

/**
 * Why the door stays shut, and what the desk does about it.
 *
 * Four refusals, four different next actions — never collapsed into "cannot
 * check in". `expired` and `upcoming` are the pair that matters most: they look
 * alike and mean opposite things, one owing money and one owing nothing, and a
 * single shared message would have a receptionist asking a paid-up member to
 * pay again.
 *
 * Keys are full literals, never built from `reason`: `strictKeyChecks` rejects
 * a template-literal key.
 */
const REFUSAL = {
  // The one an override cannot lift, so it says so outright — otherwise a
  // manager is fetched to press a button that would 403 anyway.
  suspended: {
    icon: Alert02Icon,
    tone: 'text-destructive',
    meansKey: 'checkIns.refusal.suspended',
    nextKey: 'checkIns.refusal.suspendedNext',
  },
  expired: {
    icon: AlertCircleIcon,
    tone: 'text-destructive',
    meansKey: 'checkIns.refusal.expired',
    nextKey: 'checkIns.refusal.expiredNext',
  },
  // Deliberately not destructive: nobody owes anything here, and alarming
  // colour on a member who has already paid reads as a demand.
  upcoming: {
    icon: Calendar03Icon,
    tone: 'text-foreground',
    meansKey: 'checkIns.refusal.upcoming',
    nextKey: 'checkIns.refusal.upcomingNext',
  },
  none: {
    icon: MinusSignCircleIcon,
    tone: 'text-foreground',
    meansKey: 'checkIns.refusal.none',
    nextKey: 'checkIns.refusal.noneNext',
  },
} as const;

export function CheckInRefusal({
  reason,
  expiresOn,
  nextStartsOn,
}: {
  reason: CheckInRefusalReason;
  /** The furthest `endsOn`, used to date an expiry. */
  expiresOn?: string | null;
  nextStartsOn?: string | null;
}) {
  const { t } = useTranslation();
  const config = REFUSAL[reason];

  // Only reachable if the API adds a fifth reason — a contract break, not a
  // state. Rendering nothing beats guessing at what the desk should do.
  if (!config) return null;

  // "Expired on 30 Nov" is what settles the conversation at the desk; the
  // dateless wording is the fallback for a member whose expiry did not come
  // back with the row.
  const means =
    reason === 'expired' && expiresOn
      ? t('checkIns.refusal.expiredOn', { date: formatDate(expiresOn) })
      : // "Come back on the 1st" is the whole conversation at the desk, and it
        // is the cheapest of the four refusals to close out — no money changes
        // hands, nobody is fetched, they just need the date.
        reason === 'upcoming' && nextStartsOn
        ? t('checkIns.refusal.upcomingOn', { date: formatDate(nextStartsOn) })
        : t(config.meansKey);

  return (
    <div className="flex max-w-xs items-start gap-1.5 text-right text-xs">
      <span className="flex flex-col gap-0.5">
        <span className={cn('font-medium', config.tone)}>{means}</span>
        {/* The next action, which is the whole reason the four reasons are
            kept apart. */}
        <span className="text-muted-foreground">{t(config.nextKey)}</span>
      </span>
      <HugeiconsIcon
        icon={config.icon}
        className={cn('mt-0.5 size-3.5 shrink-0', config.tone)}
      />
    </div>
  );
}

/**
 * The refusal this member's own record implies, before anything is sent.
 *
 * The same four answers the API gives, derived from the same two fields the
 * badge renders — so a blocked member's button is visibly unavailable rather
 * than one that fails. Suspension is checked first because the API checks it
 * first, and because it is the refusal `checkin.override` does not bypass.
 */
export function derivedRefusal(
  member: Pick<MemberListItem, 'isSuspended' | 'membershipStatus'>,
): CheckInRefusalReason | null {
  if (member.isSuspended) return 'suspended';

  switch (member.membershipStatus) {
    case 'active':
      return null;
    case 'expired':
      return 'expired';
    case 'upcoming':
      return 'upcoming';
    // `never` on the member, `none` on the wire: the same answer named from
    // two sides, and the mapping lives here rather than being assumed equal.
    case 'never':
      return 'none';
  }
}

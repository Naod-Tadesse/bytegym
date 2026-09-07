import { useTranslation } from 'react-i18next';
import { HugeiconsIcon } from '@hugeicons/react';
import { ShieldKeyIcon } from '@hugeicons/core-free-icons';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { MembershipStatusBadge } from '@/features/members/components/membership-status-badge';
import { formatGymTime, gymDaysUntil } from '@/lib/gym-day';
import { cn } from '@/lib/utils';
import type { CheckIn } from '../data/types';

/**
 * The list arrives with one `memberName` string rather than a first/last pair,
 * so the initials come from its words — first and last, skipping any middle
 * name, which is how a name reads on a badge.
 */
function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';

  const first = words[0]?.[0] ?? '';
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? '') : '';

  return `${first}${last}`.toUpperCase();
}

interface CheckInCardProps {
  checkIn: CheckIn;
  /**
   * Only at `all` data scope. At `branch` scope every row is the caller's own
   * branch, so the line would repeat one value down the page.
   */
  showBranch: boolean;
}

/**
 * Green past the halfway mark of what they paid for, red at or below it.
 *
 * A proportion rather than a fixed number of days, because "ten days left"
 * means opposite things on a monthly and an annual plan: a third of the way
 * through the first, and practically over on the second.
 */
const HALFWAY = 0.5;

/**
 * One admitted member, as a card rather than a table row.
 *
 * The search results directly above are cards, and a table underneath them made
 * the screen change visual language halfway down — the same list of people,
 * twice, in two different shapes. The manager reading this at close wants time,
 * who, and whether anyone was waved through; a card says all three without a
 * horizontal scan.
 */
export function CheckInCard({ checkIn, showBranch }: CheckInCardProps) {
  const { t } = useTranslation();
  const daysLeft = checkIn.expiresOn ? gymDaysUntil(checkIn.expiresOn) : 0;

  // Inclusive of both ends: a membership running today to today is one day, not
  // zero. Null cover means no denominator, so nothing is claimed either way.
  const totalDays =
    checkIn.coverStartsOn && checkIn.expiresOn
      ? gymDaysUntil(checkIn.expiresOn) -
        gymDaysUntil(checkIn.coverStartsOn) +
        1
      : null;
  const isHealthy = totalDays !== null && daysLeft > totalDays * HALFWAY;

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-xl border p-4">
      <Avatar className="size-11">
        <AvatarFallback>{initials(checkIn.memberName)}</AvatarFallback>
      </Avatar>

      <div className="flex min-w-0 flex-col gap-1">
        <span className="font-medium">{checkIn.memberName}</span>
        <span className="text-xs tabular-nums text-muted-foreground">
          {showBranch
            ? `${checkIn.memberCode} · ${checkIn.branchName}`
            : checkIn.memberCode}
        </span>
      </div>

      {/* Where they stand NOW. Someone can be admitted this morning on a
          membership that runs out tonight, so this is the line that turns a
          list of arrivals into a list of renewals to ask for. */}
      <div className="flex items-center gap-2">
        <MembershipStatusBadge status={checkIn.membershipStatus} />
        {checkIn.membershipStatus === 'active' && checkIn.expiresOn && (
          <span
            className={cn(
              'flex items-baseline gap-1.5 whitespace-nowrap',
              // Green only when we can actually prove it — an unknown span
              // stays neutral rather than guessing in the reassuring
              // direction.
              totalDays === null
                ? 'text-muted-foreground'
                : isHealthy
                  ? 'text-emerald-600 dark:text-emerald-500'
                  : 'text-destructive',
            )}
          >
            <span className="text-2xl leading-none font-semibold tabular-nums">
              {daysLeft}
            </span>
            <span className="text-xs">
              {daysLeft === 0
                ? t('checkIns.today.lastDay')
                : t('checkIns.today.daysLeftUnit', { count: daysLeft })}
            </span>
          </span>
        )}
      </div>

      <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
        {/* Only on the rows that carry one. A "standard" badge on the other
            ninety-five percent would bury the exceptions, and the exceptions
            are the reason this list is read at all. */}
        {checkIn.overrideByName && (
          <Badge variant="outline">
            <HugeiconsIcon icon={ShieldKeyIcon} data-icon="inline-start" />
            {t('checkIns.overrideBy', { name: checkIn.overrideByName })}
          </Badge>
        )}

        <div className="flex flex-col items-end gap-0.5">
          {/* The gym's clock, not the browser's — the same reason the day is
              the gym's. */}
          <span className="font-medium tabular-nums whitespace-nowrap">
            {formatGymTime(checkIn.checkedInAt)}
          </span>
          {/* Nullable: a soft-deleted staff row leaves the join empty. */}
          <span className="text-xs whitespace-nowrap text-muted-foreground">
            {checkIn.recordedByName
              ? t('checkIns.today.recordedBy', {
                  name: checkIn.recordedByName,
                })
              : '—'}
          </span>
        </div>
      </div>
    </div>
  );
}

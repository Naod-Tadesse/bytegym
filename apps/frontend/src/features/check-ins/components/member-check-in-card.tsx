import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  ArrowRight01Icon,
  CheckmarkCircle02Icon,
  ShieldKeyIcon,
} from '@hugeicons/core-free-icons';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { MembershipStatusBadge } from '@/features/members/components/membership-status-badge';
import type { MemberListItem } from '@/features/members/data/types';
import { formatGymTime } from '@/lib/gym-day';
import type { CheckInOutcome } from '../data/types';
import { CheckInRefusal, derivedRefusal } from './check-in-refusal';

interface MemberCheckInCardProps {
  member: MemberListItem;
  /** What happened when this member was last scanned here, if they were. */
  outcome?: CheckInOutcome;
  isPending: boolean;
  /**
   * `override` is true only when this card's button is the override one — the
   * decision travels with the click that made it, rather than being inferred
   * from the caller's permissions further down.
   */
  onCheckIn: (override: boolean) => void;
}

/**
 * One search result: who they are, whether they may come in, and the one button
 * that acts on it.
 *
 * A card rather than a table row on purpose — the verdict has to be readable
 * before anyone clicks anything, and a row would bury it in a column.
 */
export function MemberCheckInCard({
  member,
  outcome,
  isPending,
  onCheckIn,
}: MemberCheckInCardProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();

  // The server's answer wins when it has spoken: our row may be a few seconds
  // stale, and the reason it sent is the one the door actually refused on.
  const serverRefusal = outcome?.kind === 'refused' ? outcome.reason : null;
  const refusal = serverRefusal ?? derivedRefusal(member);

  const isSuspended = refusal === 'suspended';
  const needsOverride = refusal !== null && !isSuspended;

  const canRecord = hasPermission('checkin.record');
  const canOverride = hasPermission('checkin.override');

  // Suspension is absolute: `checkin.override` does not bypass it server-side,
  // so offering the button here would only produce a 403 and a puzzled
  // receptionist. Everything else is overridable by someone holding the
  // permission — and disabled, with the reason beside it, for anyone who is not.
  const disabled = isSuspended || (needsOverride && !canOverride);
  const isOverride = needsOverride && canOverride;

  const admitted = outcome?.kind === 'admitted' ? outcome : undefined;

  return (
    <div className="flex flex-wrap items-center gap-4 rounded-xl border p-4">
      <Avatar className="size-11">
        <AvatarFallback>
          {`${member.firstName[0] ?? ''}${member.lastName[0] ?? ''}`.toUpperCase()}
        </AvatarFallback>
      </Avatar>

      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="text-base font-semibold">
          {member.firstName} {member.lastName}
        </span>
        <span className="text-xs tabular-nums text-muted-foreground">
          {member.memberCode} · {member.phone}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          {/* The verdict, spelled out before anyone reaches for the button. */}
          <MembershipStatusBadge
            status={member.membershipStatus}
            expiresOn={member.expiresOn}
          />
          {/* Only when true. Unlike the member's own record, this card is a
              queue of people to admit — a "not suspended" badge on every one
              of them would bury the one that is. */}
          {member.isSuspended && (
            <Badge variant="destructive">
              {t('members.suspension.suspended')}
            </Badge>
          )}
        </div>
      </div>

      <div className="ml-auto flex flex-col items-end gap-2">
        {/* Not shown once they are in: the refusal that was overridden is
            history, and the confirmation is what the desk needs to read. */}
        {refusal && !admitted && (
          <CheckInRefusal reason={refusal} expiresOn={member.expiresOn} />
        )}

        <div className="flex items-center gap-2">
          {/* Where every refusal is actually resolved — a renewal is sold, a
              start date is looked up — so it is offered beside the reason
              rather than left as an exercise. */}
          {refusal && !admitted && hasPermission('member.read') && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                navigate({
                  to: '/members/$memberId',
                  params: { memberId: member.personId },
                })
              }
            >
              {t('checkIns.actions.openMember')}
              <HugeiconsIcon icon={ArrowRight01Icon} data-icon="inline-end" />
            </Button>
          )}

          {admitted ? (
            // A repeat scan says so rather than reading as a second admission:
            // the desk needs to know the scan registered *and* that it added
            // nothing. Both carry the time, which is the question that follows.
            <Badge variant={admitted.wasNew ? 'default' : 'secondary'}>
              <HugeiconsIcon
                icon={CheckmarkCircle02Icon}
                data-icon="inline-start"
              />
              {admitted.wasNew
                ? t('checkIns.outcome.admitted', {
                    time: formatGymTime(admitted.checkedInAt),
                  })
                : t('checkIns.outcome.already', {
                    time: formatGymTime(admitted.checkedInAt),
                  })}
            </Badge>
          ) : (
            canRecord && (
              <Button
                // An override is not a normal admission and must not look like
                // one: outlined and key-marked, so nobody waves someone in
                // without noticing they did.
                variant={isOverride ? 'outline' : 'default'}
                disabled={disabled || isPending}
                // The flag rides on this click and nowhere else. A normal
                // admit posts no `override` at all, so holding the permission
                // can never wave someone through by itself.
                onClick={() => onCheckIn(isOverride)}
              >
                {isPending ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <HugeiconsIcon
                    icon={isOverride ? ShieldKeyIcon : CheckmarkCircle02Icon}
                    data-icon="inline-start"
                  />
                )}
                {isOverride
                  ? t('checkIns.actions.override')
                  : t('checkIns.actions.checkIn')}
              </Button>
            )
          )}
        </div>
      </div>
    </div>
  );
}

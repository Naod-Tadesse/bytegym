import { useTranslation } from 'react-i18next';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  AlertCircleIcon,
  CheckmarkCircle02Icon,
  MinusSignCircleIcon,
} from '@hugeicons/core-free-icons';

import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/format';
import type { MembershipStatus } from '../data/types';

/**
 * The verdict the front desk reads before letting someone through the door.
 *
 * Full literal i18n keys, never built from the status value — `strictKeyChecks`
 * rejects a template-literal key. Each state pairs a colour with an icon so it
 * never rests on colour alone.
 *
 * These are **not** `members.suspension.*`: suspension is being barred from the
 * premises, this is having paid. A member can be either, both or neither, and
 * merging the two would hide the one that decides what to do next.
 */
const MEMBERSHIP_STATUS = {
  active: {
    labelKey: 'members.status.active',
    variant: 'default',
    icon: CheckmarkCircle02Icon,
  },
  expired: {
    labelKey: 'members.status.expired',
    variant: 'destructive',
    icon: AlertCircleIcon,
  },
  // `never` is a real answer — they have not bought a membership yet — and the
  // next step is to sell them one. Rendering nothing would read as missing data.
  never: {
    labelKey: 'members.status.never',
    variant: 'outline',
    icon: MinusSignCircleIcon,
  },
} as const;

export function MembershipStatusBadge({
  status,
  expiresOn,
}: {
  status: MembershipStatus;
  /** The furthest `endsOn`; `null` when they have never held a membership. */
  expiresOn?: string | null;
}) {
  const { t } = useTranslation();
  const config = MEMBERSHIP_STATUS[status];

  // Only reachable if the API stops sending the field — a contract break, not
  // a state. Distinct from `never`, which is a member who has not bought one:
  // claiming that here would be a wrong answer rather than a missing one, and
  // a blank cell is a better symptom than a destroyed page.
  if (!config) return null;

  const { labelKey, variant, icon } = config;

  return (
    <span className="inline-flex items-center gap-2">
      <Badge variant={variant}>
        <HugeiconsIcon icon={icon} data-icon="inline-start" />
        {t(labelKey)}
      </Badge>
      {/* "Active until 30 Nov" is what a receptionist needs; a green dot alone
          does not say whether to sell a renewal today. */}
      {status === 'active' && expiresOn && (
        <span className="text-xs whitespace-nowrap text-muted-foreground">
          {t('members.status.until', { date: formatDate(expiresOn) })}
        </span>
      )}
    </span>
  );
}

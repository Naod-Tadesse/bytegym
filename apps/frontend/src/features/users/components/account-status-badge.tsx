import { useTranslation } from 'react-i18next';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  CheckmarkCircle02Icon,
  UserBlock01Icon,
} from '@hugeicons/core-free-icons';

import { Badge } from '@/components/ui/badge';
import type { AccountStatus } from '@/features/staff/data/types';

/**
 * Full literal i18n keys, never built from the status value — `strictKeyChecks`
 * rejects template-literal keys. Each status pairs a colour with an icon so it
 * never rests on colour alone.
 *
 * `disabled` is `outline`, not `destructive`: it is a suspension the password
 * survives, and the destructive weight belongs to revoking.
 */
const ACCOUNT_STATUS = {
  active: {
    labelKey: 'users.accountStatus.active',
    variant: 'default',
    icon: CheckmarkCircle02Icon,
  },
  disabled: {
    labelKey: 'users.accountStatus.disabled',
    variant: 'outline',
    icon: UserBlock01Icon,
  },
} as const;

export function AccountStatusBadge({ status }: { status: AccountStatus }) {
  const { t } = useTranslation();
  const { labelKey, variant, icon } = ACCOUNT_STATUS[status];

  return (
    <Badge variant={variant}>
      <HugeiconsIcon icon={icon} data-icon="inline-start" />
      {t(labelKey)}
    </Badge>
  );
}

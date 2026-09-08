import { useTranslation } from 'react-i18next';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Alert02Icon,
  CheckmarkCircle02Icon,
  Message01Icon,
  PauseIcon,
  UserGroupIcon,
} from '@hugeicons/core-free-icons';

import { Badge } from '@/components/ui/badge';
import type { SmsKind, SmsStatus } from '../data/types';

/**
 * `held` is `secondary`, never `destructive`.
 *
 * It is not a failure: the test allowlist stopped the message, so nothing was
 * attempted and nothing was charged. Painting it red would have the gym chasing
 * a provider fault that does not exist.
 */
const STATUS = {
  sent: {
    labelKey: 'sms.status.sent',
    variant: 'default',
    icon: CheckmarkCircle02Icon,
  },
  held: { labelKey: 'sms.status.held', variant: 'secondary', icon: PauseIcon },
  failed: {
    labelKey: 'sms.status.failed',
    variant: 'destructive',
    icon: Alert02Icon,
  },
} as const;

const KIND = {
  direct: { labelKey: 'sms.kind.direct', icon: Message01Icon },
  bulk: { labelKey: 'sms.kind.bulk', icon: UserGroupIcon },
  reminder: { labelKey: 'sms.kind.reminder', icon: Alert02Icon },
} as const;

export function SmsStatusBadge({ status }: { status: SmsStatus }) {
  const { t } = useTranslation();
  const config = STATUS[status];
  if (!config) return null;

  return (
    <Badge variant={config.variant}>
      <HugeiconsIcon icon={config.icon} data-icon="inline-start" />
      {t(config.labelKey)}
    </Badge>
  );
}

export function SmsKindBadge({ kind }: { kind: SmsKind }) {
  const { t } = useTranslation();
  const config = KIND[kind];
  if (!config) return null;

  return (
    <Badge variant="outline">
      <HugeiconsIcon icon={config.icon} data-icon="inline-start" />
      {t(config.labelKey)}
    </Badge>
  );
}

/** Options for the log's faceted filters. Closed enums, so a plain list. */
export function useSmsStatusOptions() {
  const { t } = useTranslation();
  return (Object.keys(STATUS) as SmsStatus[]).map((status) => ({
    value: status,
    label: t(STATUS[status].labelKey),
  }));
}

export function useSmsKindOptions() {
  const { t } = useTranslation();
  return (Object.keys(KIND) as SmsKind[]).map((kind) => ({
    value: kind,
    label: t(KIND[kind].labelKey),
  }));
}

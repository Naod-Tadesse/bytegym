import { useTranslation } from 'react-i18next';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Cancel01Icon,
  CheckmarkCircle02Icon,
  Clock01Icon,
} from '@hugeicons/core-free-icons';

import { Badge } from '@/components/ui/badge';
import type { EmploymentStatus } from '../data/types';

/**
 * Full literal i18n keys, never built from the status value — `strictKeyChecks`
 * rejects template-literal keys. Each status pairs a colour with an icon so it
 * never rests on colour alone.
 */
const EMPLOYMENT_STATUS = {
  active: {
    labelKey: 'staff.employmentStatus.active',
    variant: 'default',
    icon: CheckmarkCircle02Icon,
  },
  on_leave: {
    labelKey: 'staff.employmentStatus.onLeave',
    variant: 'outline',
    icon: Clock01Icon,
  },
  terminated: {
    labelKey: 'staff.employmentStatus.terminated',
    variant: 'destructive',
    icon: Cancel01Icon,
  },
} as const;

export function EmploymentStatusBadge({
  status,
}: {
  status: EmploymentStatus;
}) {
  const { t } = useTranslation();
  const { labelKey, variant, icon } = EMPLOYMENT_STATUS[status];

  return (
    <Badge variant={variant}>
      <HugeiconsIcon icon={icon} data-icon="inline-start" />
      {t(labelKey)}
    </Badge>
  );
}

/** Options for the edit form's status select. */
export function useEmploymentStatusOptions() {
  const { t } = useTranslation();

  return [
    { value: 'active', label: t('staff.employmentStatus.active') },
    { value: 'on_leave', label: t('staff.employmentStatus.onLeave') },
    { value: 'terminated', label: t('staff.employmentStatus.terminated') },
  ];
}

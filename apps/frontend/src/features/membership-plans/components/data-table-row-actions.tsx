import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { Archive02Icon, PencilEdit02Icon } from '@hugeicons/core-free-icons';

import { RowActions, type RowAction } from '@/components/table/row-actions';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { useMembershipPlanContext } from '../context/membership-plan-context';
import type { MembershipPlan } from '../data/types';

export function MembershipPlanRowActions({ plan }: { plan: MembershipPlan }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { setOpen, setCurrentRow } = useMembershipPlanContext();
  const { hasPermission } = usePermissions();

  // Both entries are a PATCH, so both are `plan.update` — the permission the
  // API actually enforces. There is deliberately no `plan.delete`.
  if (!hasPermission('plan.update')) return null;

  const actions: RowAction[] = [
    {
      key: 'edit',
      label: t('actions.edit'),
      icon: PencilEdit02Icon,
      onSelect: () =>
        navigate({
          to: '/membership-plans/$planId/edit',
          params: { planId: plan.id },
        }),
    },
    {
      key: 'retire',
      label: t('plans.actions.retire'),
      icon: Archive02Icon,
      destructive: true,
      // A retired plan is put back on sale from the edit page's switch, so
      // this entry only ever points one way — and says so rather than
      // disappearing off the row.
      disabled: !plan.isActive,
      disabledReason: t('plans.actions.alreadyRetired'),
      onSelect: () => {
        setCurrentRow(plan);
        setOpen('retire');
      },
    },
  ];

  return <RowActions actions={actions} />;
}

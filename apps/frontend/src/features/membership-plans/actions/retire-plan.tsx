import { useTranslation } from 'react-i18next';

import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { settle } from '@/lib/settle';
import type { MembershipPlan } from '../data/types';
import { useRetireMembershipPlan } from '../hooks/use-membership-plans';

interface RetirePlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: MembershipPlan;
}

/**
 * Retire, not delete. There is no `plan.delete` and no DELETE route — every
 * membership ever sold points at this row, so the wording has to make clear
 * that nothing a member already paid for is affected.
 */
export function RetirePlanDialog({
  open,
  onOpenChange,
  plan,
}: RetirePlanDialogProps) {
  const { t } = useTranslation();
  const { retirePlanAsync, isPending } = useRetireMembershipPlan();

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('plans.retire.title')}
      description={t('plans.retire.description', { name: plan.name })}
      confirmLabel={t('plans.retire.confirm')}
      cancelLabel={t('actions.cancel')}
      confirmVariant="destructive"
      isPending={isPending}
      onConfirm={() => settle(retirePlanAsync({ planId: plan.id }))}
    />
  );
}

import { useTranslation } from 'react-i18next';

import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { settle } from '@/lib/settle';
import type { Branch } from '../data/types';
import { useDeactivateBranch } from '../hooks/use-branches';

interface DeactivateBranchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branch: Branch;
}

export function DeactivateBranchDialog({
  open,
  onOpenChange,
  branch,
}: DeactivateBranchDialogProps) {
  const { t } = useTranslation();
  const { deactivateBranchAsync, isPending } = useDeactivateBranch();

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('branches.deactivate.title')}
      description={t('branches.deactivate.description', { name: branch.name })}
      confirmLabel={t('branches.deactivate.confirm')}
      cancelLabel={t('actions.cancel')}
      confirmVariant="destructive"
      isPending={isPending}
      onConfirm={() => settle(deactivateBranchAsync({ branchId: branch.id }))}
    />
  );
}

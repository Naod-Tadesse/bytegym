import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { Delete02Icon, PencilEdit02Icon } from '@hugeicons/core-free-icons';

import { RowActions, type RowAction } from '@/components/table/row-actions';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { useBranchContext } from '../context/branch-context';
import type { Branch } from '../data/types';

export function BranchRowActions({ branch }: { branch: Branch }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { setOpen, setCurrentRow } = useBranchContext();
  const { hasPermission } = usePermissions();

  // Both entries are gated by the same permission the API enforces.
  if (!hasPermission('branch.update')) return null;

  const actions: RowAction[] = [
    {
      key: 'edit',
      label: t('actions.edit'),
      icon: PencilEdit02Icon,
      onSelect: () =>
        navigate({
          to: '/branches/$branchId/edit',
          params: { branchId: branch.id },
        }),
    },
    {
      key: 'deactivate',
      label: t('actions.deactivate'),
      icon: Delete02Icon,
      destructive: true,
      // Shown on a retired branch rather than hidden: the button vanishing is
      // indistinguishable from a permission you never had, and "already
      // deactivated" is the answer the reader wants.
      disabled: !branch.isActive,
      disabledReason: t('branches.actions.alreadyInactive'),
      onSelect: () => {
        setCurrentRow(branch);
        setOpen('deactivate');
      },
    },
  ];

  return <RowActions actions={actions} />;
}

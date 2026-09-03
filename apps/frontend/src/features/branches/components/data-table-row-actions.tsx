import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Delete02Icon,
  MoreHorizontalIcon,
  PencilEdit02Icon,
} from '@hugeicons/core-free-icons';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
        <HugeiconsIcon icon={MoreHorizontalIcon} />
        <span className="sr-only">{t('actions.rowActions')}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          onClick={() =>
            navigate({
              to: '/branches/$branchId/edit',
              params: { branchId: branch.id },
            })
          }
        >
          <HugeiconsIcon icon={PencilEdit02Icon} data-icon="inline-start" />
          {t('actions.edit')}
        </DropdownMenuItem>
        {branch.isActive && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => {
                setCurrentRow(branch);
                setOpen('deactivate');
              }}
            >
              <HugeiconsIcon icon={Delete02Icon} data-icon="inline-start" />
              {t('actions.deactivate')}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

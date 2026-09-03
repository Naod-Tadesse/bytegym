import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Delete02Icon,
  MoreHorizontalIcon,
  PencilEdit02Icon,
  ShieldKeyIcon,
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
import { useRoleContext } from '../context/role-context';
import type { Role } from '../data/types';

export function RoleRowActions({ role }: { role: Role }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { setOpen, setCurrentRow } = useRoleContext();
  const { hasPermission } = usePermissions();

  const canUpdate = hasPermission('role.update');
  const canAssign = hasPermission('role.assign');
  const canDelete = hasPermission('role.delete');

  // Nothing to offer — do not render an empty menu.
  if (!canUpdate && !canAssign && !canDelete) return null;

  const select = (dialog: 'edit' | 'delete') => () => {
    setCurrentRow(role);
    setOpen(dialog);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
        <HugeiconsIcon icon={MoreHorizontalIcon} />
        <span className="sr-only">{t('actions.rowActions')}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {canUpdate && (
          <DropdownMenuItem onClick={select('edit')}>
            <HugeiconsIcon icon={PencilEdit02Icon} data-icon="inline-start" />
            {t('actions.edit')}
          </DropdownMenuItem>
        )}
        {canAssign && (
          <DropdownMenuItem
            onClick={() =>
              navigate({
                to: '/roles/$roleId/permissions',
                params: { roleId: role.id },
              })
            }
          >
            <HugeiconsIcon icon={ShieldKeyIcon} data-icon="inline-start" />
            {t('roles.actions.managePermissions')}
          </DropdownMenuItem>
        )}
        {canDelete && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={select('delete')}>
              <HugeiconsIcon icon={Delete02Icon} data-icon="inline-start" />
              {t('actions.delete')}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

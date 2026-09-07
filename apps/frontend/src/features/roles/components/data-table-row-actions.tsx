import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import {
  Delete02Icon,
  PencilEdit02Icon,
  ShieldKeyIcon,
} from '@hugeicons/core-free-icons';

import { RowActions, type RowAction } from '@/components/table/row-actions';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { useRoleContext } from '../context/role-context';
import type { Role } from '../data/types';

export function RoleRowActions({ role }: { role: Role }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { setOpen, setCurrentRow } = useRoleContext();
  const { hasPermission } = usePermissions();

  const select = (dialog: 'edit' | 'delete') => () => {
    setCurrentRow(role);
    setOpen(dialog);
  };

  // Missing permissions drop the entry entirely — an action you may never
  // perform is not worth advertising, disabled or otherwise.
  const actions: RowAction[] = [
    ...(hasPermission('role.update')
      ? [
          {
            key: 'edit',
            label: t('actions.edit'),
            icon: PencilEdit02Icon,
            onSelect: select('edit'),
          },
        ]
      : []),
    ...(hasPermission('role.assign')
      ? [
          {
            key: 'permissions',
            label: t('roles.actions.managePermissions'),
            icon: ShieldKeyIcon,
            onSelect: () =>
              navigate({
                to: '/roles/$roleId/permissions',
                params: { roleId: role.id },
              }),
          },
        ]
      : []),
    ...(hasPermission('role.delete')
      ? [
          {
            key: 'delete',
            label: t('actions.delete'),
            icon: Delete02Icon,
            destructive: true,
            onSelect: select('delete'),
          },
        ]
      : []),
  ];

  return <RowActions actions={actions} />;
}

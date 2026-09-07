import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import {
  Delete02Icon,
  PencilEdit02Icon,
  UserBlock01Icon,
  UserCheck01Icon,
  ViewIcon,
} from '@hugeicons/core-free-icons';

import { RowActions, type RowAction } from '@/components/table/row-actions';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { useMemberContext } from '../context/member-context';
import type { MemberListItem } from '../data/types';

export function MemberRowActions({ member }: { member: MemberListItem }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { setOpen, setCurrentRow } = useMemberContext();
  const { hasPermission } = usePermissions();

  const openDialog = (dialog: 'suspend' | 'delete') => () => {
    setCurrentRow(member);
    setOpen(dialog);
  };

  // Gated on the permission each endpoint actually enforces. View opens
  // `GET /members/:id`, which is `member.read` — not `member.list`, which only
  // got them onto this screen. Suspension is a PATCH on the member, so it is
  // `member.update`, not a permission of its own.
  const canUpdate = hasPermission('member.update');

  const actions: RowAction[] = [
    ...(hasPermission('member.read')
      ? [
          {
            key: 'view',
            label: t('actions.view'),
            icon: ViewIcon,
            onSelect: () =>
              navigate({
                to: '/members/$memberId',
                params: { memberId: member.personId },
              }),
          },
        ]
      : []),
    ...(canUpdate
      ? [
          {
            key: 'edit',
            label: t('actions.edit'),
            icon: PencilEdit02Icon,
            onSelect: () =>
              navigate({
                to: '/members/$memberId/edit',
                params: { memberId: member.personId },
              }),
          },
          {
            key: 'suspend',
            icon: member.isSuspended ? UserCheck01Icon : UserBlock01Icon,
            // Full literal keys: `strictKeyChecks` rejects a built one.
            label: member.isSuspended
              ? t('members.actions.unsuspend')
              : t('members.actions.suspend'),
            onSelect: openDialog('suspend'),
          },
        ]
      : []),
    ...(hasPermission('member.delete')
      ? [
          {
            key: 'delete',
            label: t('actions.delete'),
            icon: Delete02Icon,
            destructive: true,
            onSelect: openDialog('delete'),
          },
        ]
      : []),
  ];

  return <RowActions actions={actions} />;
}

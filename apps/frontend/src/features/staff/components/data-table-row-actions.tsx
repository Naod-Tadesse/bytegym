import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import {
  Delete02Icon,
  UserUnlock01Icon,
  PencilEdit02Icon,
  ViewIcon,
} from '@hugeicons/core-free-icons';

import { RowActions, type RowAction } from '@/components/table/row-actions';
import { useCurrentUser } from '@/features/auth/hooks/use-auth';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { useStaffContext } from '../context/staff-context';
import type { StaffListItem } from '../data/types';

/**
 * Employment actions only. Reset password, grant access and revoke access all
 * live on the users screen now — this roster answers "who works here", not
 * "who can sign in", and mixing the two is what made the old menu confusing.
 */
export function StaffRowActions({
  staffMember,
}: {
  staffMember: StaffListItem;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { setOpen, setCurrentRow } = useStaffContext();
  const { hasPermission } = usePermissions();
  const { data: currentUser } = useCurrentUser();

  const goTo = (to: '/staff/$staffId' | '/staff/$staffId/edit') => () =>
    navigate({ to, params: { staffId: staffMember.personId } });

  const openDialog = (dialog: 'terminate' | 'grantAccess') => () => {
    setCurrentRow(staffMember);
    setOpen(dialog);
  };

  const isSelf = currentUser?.id === staffMember.personId;
  const isTerminated = staffMember.employmentStatus === 'terminated';

  // Permission decides whether an entry exists at all; state only decides
  // whether it is live. The API refuses both self-termination and a second
  // login with a 403, so neither is offered as a click that fails — but they
  // stay on screen, saying why, rather than silently not being there.
  const terminateReason = isSelf
    ? t('staff.actions.terminateSelf')
    : isTerminated
      ? t('staff.actions.alreadyTerminated')
      : undefined;

  // Disabled-with-a-reason earns its place only where someone might actually
  // try. Nobody reaches for "grant access" on a row that already has a login,
  // and that state never flips back — so most of the roster would carry a
  // permanently dead button. Hidden there, and shown-but-disabled only for a
  // terminated employee, where the attempt is plausible and the reason useful.
  const canGrantAccess =
    hasPermission('staff.grantAccess') && !staffMember.hasAccount;

  const grantAccessReason = isTerminated
    ? t('staff.grantAccess.terminated')
    : undefined;

  const actions: RowAction[] = [
    ...(hasPermission('staff.read')
      ? [
          {
            key: 'view',
            label: t('actions.view'),
            icon: ViewIcon,
            onSelect: goTo('/staff/$staffId'),
          },
        ]
      : []),
    ...(hasPermission('staff.update')
      ? [
          {
            key: 'edit',
            label: t('actions.edit'),
            icon: PencilEdit02Icon,
            onSelect: goTo('/staff/$staffId/edit'),
          },
        ]
      : []),
    ...(canGrantAccess
      ? [
          {
            key: 'grantAccess',
            label: t('staff.grantAccess.action'),
            icon: UserUnlock01Icon,
            disabled: grantAccessReason !== undefined,
            disabledReason: grantAccessReason,
            onSelect: openDialog('grantAccess'),
          },
        ]
      : []),
    ...(hasPermission('staff.terminate')
      ? [
          {
            key: 'terminate',
            label: t('staff.actions.terminate'),
            icon: Delete02Icon,
            destructive: true,
            disabled: terminateReason !== undefined,
            disabledReason: terminateReason,
            onSelect: openDialog('terminate'),
          },
        ]
      : []),
  ];

  return <RowActions actions={actions} />;
}

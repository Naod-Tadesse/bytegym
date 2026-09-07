import { useTranslation } from 'react-i18next';
import {
  Delete02Icon,
  LockPasswordIcon,
  ShieldKeyIcon,
  UserLock01Icon,
  UserUnlock01Icon,
} from '@hugeicons/core-free-icons';

import { RowActions, type RowAction } from '@/components/table/row-actions';
import { useCurrentUser } from '@/features/auth/hooks/use-auth';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { useUserContext } from '../context/user-context';
import type { UserListItem } from '../data/types';

export function UserRowActions({ user }: { user: UserListItem }) {
  const { t } = useTranslation();
  const { setOpen, setCurrentRow } = useUserContext();
  const { hasPermission } = usePermissions();
  const { data: currentUser } = useCurrentUser();

  // Deliberately NOT staff.update: changing what someone may reach is an
  // access decision, so it does not imply the right to rename them.
  const canEditAccess = hasPermission('role.assign');
  const canResetPassword = hasPermission('staff.resetPassword');
  // One permission covers disabling and revoking — they are the same authority
  // over someone's credential, applied reversibly or not.
  const canChangeAccess = hasPermission('staff.revokeAccess');

  // Never actionable against yourself: the API 403s rather than let you lock
  // yourself out. Shown disabled with the reason rather than dropped, so the
  // row does not look like a permission problem.
  const isSelf = currentUser?.id === user.personId;
  const selfReason = isSelf ? t('users.actions.notYourself') : undefined;

  const isDisabled = user.status === 'disabled';

  const openDialog =
    (dialog: 'editAccess' | 'resetPassword' | 'toggleLogin' | 'revokeAccess') =>
    () => {
      setCurrentRow(user);
      setOpen(dialog);
    };

  const actions: RowAction[] = [
    ...(canEditAccess
      ? [
          {
            key: 'editAccess',
            label: t('users.editAccess.action'),
            icon: ShieldKeyIcon,
            onSelect: openDialog('editAccess'),
          },
        ]
      : []),
    ...(canResetPassword
      ? [
          {
            key: 'resetPassword',
            label: t('users.resetPassword.action'),
            icon: LockPasswordIcon,
            onSelect: openDialog('resetPassword'),
          },
        ]
      : []),
    ...(canChangeAccess
      ? [
          {
            key: 'toggleLogin',
            icon: isDisabled ? UserUnlock01Icon : UserLock01Icon,
            // Full literal keys: `strictKeyChecks` rejects a built one.
            label: isDisabled
              ? t('users.enableLogin.action')
              : t('users.disableLogin.action'),
            disabled: isSelf,
            disabledReason: selfReason,
            onSelect: openDialog('toggleLogin'),
          },
          {
            key: 'revokeAccess',
            label: t('users.revokeAccess.action'),
            icon: Delete02Icon,
            destructive: true,
            disabled: isSelf,
            disabledReason: selfReason,
            onSelect: openDialog('revokeAccess'),
          },
        ]
      : []),
  ];

  return <RowActions actions={actions} />;
}

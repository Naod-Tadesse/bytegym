import { useTranslation } from 'react-i18next';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Delete02Icon,
  LockPasswordIcon,
  MoreHorizontalIcon,
  ShieldKeyIcon,
  UserLock01Icon,
  UserUnlock01Icon,
} from '@hugeicons/core-free-icons';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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

  // Never offer either to yourself: the API 403s rather than let you lock
  // yourself out, so showing the item would only buy a round trip and a toast.
  const isSelf = currentUser?.id === user.personId;
  const canDisable = canChangeAccess && !isSelf;
  const canRevoke = canChangeAccess && !isSelf;

  // Nothing to offer — do not render an empty menu.
  if (!canEditAccess && !canResetPassword && !canDisable && !canRevoke) {
    return null;
  }

  const isDisabled = user.status === 'disabled';

  const openDialog =
    (
      dialog: 'editAccess' | 'resetPassword' | 'toggleLogin' | 'revokeAccess',
    ) =>
    () => {
      setCurrentRow(user);
      setOpen(dialog);
    };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
        <HugeiconsIcon icon={MoreHorizontalIcon} />
        <span className="sr-only">{t('actions.rowActions')}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {canEditAccess && (
          <DropdownMenuItem onClick={openDialog('editAccess')}>
            <HugeiconsIcon icon={ShieldKeyIcon} data-icon="inline-start" />
            {t('users.editAccess.action')}
          </DropdownMenuItem>
        )}
        {canResetPassword && (
          <DropdownMenuItem onClick={openDialog('resetPassword')}>
            <HugeiconsIcon icon={LockPasswordIcon} data-icon="inline-start" />
            {t('users.resetPassword.action')}
          </DropdownMenuItem>
        )}
        {canDisable && (
          <DropdownMenuItem onClick={openDialog('toggleLogin')}>
            <HugeiconsIcon
              icon={isDisabled ? UserUnlock01Icon : UserLock01Icon}
              data-icon="inline-start"
            />
            {/* Full literal keys: `strictKeyChecks` rejects a built one. */}
            {isDisabled
              ? t('users.enableLogin.action')
              : t('users.disableLogin.action')}
          </DropdownMenuItem>
        )}
        {canRevoke && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={openDialog('revokeAccess')}
            >
              <HugeiconsIcon icon={Delete02Icon} data-icon="inline-start" />
              {t('users.revokeAccess.action')}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

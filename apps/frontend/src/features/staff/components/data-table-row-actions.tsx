import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Delete02Icon,
  MoreHorizontalIcon,
  UserUnlock01Icon,
  PencilEdit02Icon,
  ViewIcon,
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

  const canRead = hasPermission('staff.read');
  const canUpdate = hasPermission('staff.update');
  // The API refuses this with a 403; hiding it saves the round trip.
  const isSelf = currentUser?.id === staffMember.personId;
  const canTerminate =
    hasPermission('staff.terminate') &&
    !isSelf &&
    staffMember.employmentStatus !== 'terminated';

  // Only for someone who has no login yet — every other credential action
  // belongs on Users, which can already list them once they do.
  const canGrantAccess =
    hasPermission('staff.grantAccess') &&
    !staffMember.hasAccount &&
    staffMember.employmentStatus !== 'terminated';

  // Nothing to offer — do not render an empty menu.
  if (!canRead && !canUpdate && !canGrantAccess && !canTerminate) return null;

  const goTo = (to: '/staff/$staffId' | '/staff/$staffId/edit') => () =>
    navigate({ to, params: { staffId: staffMember.personId } });

  const openDialog = (dialog: 'terminate' | 'grantAccess') => () => {
    setCurrentRow(staffMember);
    setOpen(dialog);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" />}>
        <HugeiconsIcon icon={MoreHorizontalIcon} />
        <span className="sr-only">{t('actions.rowActions')}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {canRead && (
          <DropdownMenuItem onClick={goTo('/staff/$staffId')}>
            <HugeiconsIcon icon={ViewIcon} data-icon="inline-start" />
            {t('actions.view')}
          </DropdownMenuItem>
        )}
        {canUpdate && (
          <DropdownMenuItem onClick={goTo('/staff/$staffId/edit')}>
            <HugeiconsIcon icon={PencilEdit02Icon} data-icon="inline-start" />
            {t('actions.edit')}
          </DropdownMenuItem>
        )}
        {canGrantAccess && (
          <DropdownMenuItem onClick={openDialog('grantAccess')}>
            <HugeiconsIcon icon={UserUnlock01Icon} data-icon="inline-start" />
            {t('staff.grantAccess.action')}
          </DropdownMenuItem>
        )}
        {canTerminate && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={openDialog('terminate')}
            >
              <HugeiconsIcon icon={Delete02Icon} data-icon="inline-start" />
              {t('staff.actions.terminate')}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

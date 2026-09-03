import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Delete02Icon,
  MoreHorizontalIcon,
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
  const isSelf = currentUser?.id === staffMember.userId;
  const canTerminate =
    hasPermission('staff.terminate') &&
    !isSelf &&
    staffMember.employmentStatus !== 'terminated';

  if (!canRead && !canUpdate && !canTerminate) return null;

  const goTo = (to: '/staff/$staffId' | '/staff/$staffId/edit') => () =>
    navigate({ to, params: { staffId: staffMember.userId } });

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
        {canTerminate && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => {
                setCurrentRow(staffMember);
                setOpen('terminate');
              }}
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

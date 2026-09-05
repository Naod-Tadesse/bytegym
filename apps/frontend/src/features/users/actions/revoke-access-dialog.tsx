import { useTranslation } from 'react-i18next';

import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { settle } from '@/lib/settle';
import type { UserListItem } from '../data/types';
import { useRevokeAccess } from '../hooks/use-users';

interface RevokeAccessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: Pick<UserListItem, 'personId' | 'firstName' | 'lastName'>;
}

/**
 * Deletes the account row, and their sessions and role grants with it. They
 * stay on the roster — this is not a termination.
 *
 * The description spells out the difference from Disable, because the two
 * items sit next to each other and only one of them can be undone by flipping
 * a switch back.
 */
export function RevokeAccessDialog({
  open,
  onOpenChange,
  user,
}: RevokeAccessDialogProps) {
  const { t } = useTranslation();
  const { revokeAccessAsync, isPending } = useRevokeAccess();

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('users.revokeAccess.title')}
      description={t('users.revokeAccess.description', {
        name: `${user.firstName} ${user.lastName}`,
      })}
      confirmLabel={t('users.revokeAccess.confirm')}
      cancelLabel={t('actions.cancel')}
      confirmVariant="destructive"
      isPending={isPending}
      // A 403 (revoking your own access) already surfaced via the interceptor.
      onConfirm={() => settle(revokeAccessAsync({ staffId: user.personId }))}
    />
  );
}

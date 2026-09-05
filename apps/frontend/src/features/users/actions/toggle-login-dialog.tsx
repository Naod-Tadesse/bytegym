import { useTranslation } from 'react-i18next';

import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { settle } from '@/lib/settle';
import type { UserListItem } from '../data/types';
import { useSetLoginStatus } from '../hooks/use-users';

interface ToggleLoginDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: Pick<UserListItem, 'personId' | 'firstName' | 'lastName' | 'status'>;
}

/**
 * The reversible half of the pair. Disabling refuses sign-in and kills their
 * live sessions but KEEPS the password, so enabling hands back the credential
 * they already know — no reset, no new password to communicate.
 *
 * Contrast `RevokeAccessDialog`, which deletes the credential outright. The
 * two are one permission apart in the API and one word apart in the menu, so
 * the copy here carries the whole difference.
 */
export function ToggleLoginDialog({
  open,
  onOpenChange,
  user,
}: ToggleLoginDialogProps) {
  const { t } = useTranslation();
  const { setLoginStatusAsync, isPending } = useSetLoginStatus();

  const isDisabled = user.status === 'disabled';
  const name = `${user.firstName} ${user.lastName}`;

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      // Full literal keys on both branches — `strictKeyChecks` rejects a key
      // assembled from `status`.
      title={
        isDisabled
          ? t('users.enableLogin.title')
          : t('users.disableLogin.title')
      }
      description={
        isDisabled
          ? t('users.enableLogin.description', { name })
          : t('users.disableLogin.description', { name })
      }
      confirmLabel={
        isDisabled
          ? t('users.enableLogin.confirm')
          : t('users.disableLogin.confirm')
      }
      cancelLabel={t('actions.cancel')}
      // Reversible, so not destructive weight — revoking gets that.
      confirmVariant="default"
      isPending={isPending}
      // A 403 (disabling yourself) already surfaced via the interceptor.
      onConfirm={() =>
        settle(
          setLoginStatusAsync({
            staffId: user.personId,
            status: isDisabled ? 'active' : 'disabled',
          }),
        )
      }
    />
  );
}

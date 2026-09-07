import { useTranslation } from 'react-i18next';

import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { settle } from '@/lib/settle';
import type { MemberListItem } from '../data/types';
import { useSetMemberSuspension } from '../hooks/use-members';

interface SuspendMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: Pick<
    MemberListItem,
    'personId' | 'firstName' | 'lastName' | 'isSuspended'
  >;
}

/**
 * One dialog for both directions. The wording has to differ, though: lifting a
 * suspension is routine, imposing one bars someone at the door — so only the
 * suspending half is destructive.
 */
export function SuspendMemberDialog({
  open,
  onOpenChange,
  member,
}: SuspendMemberDialogProps) {
  const { t } = useTranslation();
  const { setSuspensionAsync, isPending } = useSetMemberSuspension();

  const next = !member.isSuspended;
  const name = `${member.firstName} ${member.lastName}`;

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={next ? t('members.suspend.title') : t('members.unsuspend.title')}
      description={
        next
          ? t('members.suspend.description', { name })
          : t('members.unsuspend.description', { name })
      }
      confirmLabel={
        next ? t('members.suspend.confirm') : t('members.unsuspend.confirm')
      }
      cancelLabel={t('actions.cancel')}
      confirmVariant={next ? 'destructive' : 'default'}
      isPending={isPending}
      onConfirm={() =>
        settle(
          setSuspensionAsync({
            memberId: member.personId,
            isSuspended: next,
          }),
        )
      }
    />
  );
}

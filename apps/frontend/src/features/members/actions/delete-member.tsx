import { useTranslation } from 'react-i18next';

import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { settle } from '@/lib/settle';
import type { MemberListItem } from '../data/types';
import { useDeleteMember } from '../hooks/use-members';

interface DeleteMemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  member: Pick<MemberListItem, 'personId' | 'firstName' | 'lastName'>;
}

export function DeleteMemberDialog({
  open,
  onOpenChange,
  member,
}: DeleteMemberDialogProps) {
  const { t } = useTranslation();
  const { deleteMemberAsync, isPending } = useDeleteMember();

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('members.delete.title')}
      description={t('members.delete.description', {
        name: `${member.firstName} ${member.lastName}`,
      })}
      confirmLabel={t('actions.delete')}
      cancelLabel={t('actions.cancel')}
      confirmVariant="destructive"
      isPending={isPending}
      onConfirm={() => settle(deleteMemberAsync({ memberId: member.personId }))}
    />
  );
}

import { useTranslation } from 'react-i18next';

import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { settle } from '@/lib/settle';
import type { Role } from '../data/types';
import { useDeleteRole } from '../hooks/use-roles';

interface DeleteRoleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  role: Role;
}

export function DeleteRoleDialog({
  open,
  onOpenChange,
  role,
}: DeleteRoleDialogProps) {
  const { t } = useTranslation();
  const { deleteRoleAsync, isPending } = useDeleteRole();

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('roles.delete.title')}
      description={t('roles.delete.description', { name: role.name })}
      confirmLabel={t('actions.delete')}
      cancelLabel={t('actions.cancel')}
      confirmVariant="destructive"
      isPending={isPending}
      onConfirm={() => settle(deleteRoleAsync({ roleId: role.id }))}
    />
  );
}

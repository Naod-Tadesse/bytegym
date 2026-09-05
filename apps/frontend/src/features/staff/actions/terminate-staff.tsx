import { useTranslation } from 'react-i18next';

import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { settle } from '@/lib/settle';
import type { StaffListItem } from '../data/types';
import { useTerminateStaff } from '../hooks/use-staff';

interface TerminateStaffDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  staffMember: Pick<StaffListItem, 'personId' | 'firstName' | 'lastName'>;
}

export function TerminateStaffDialog({
  open,
  onOpenChange,
  staffMember,
}: TerminateStaffDialogProps) {
  const { t } = useTranslation();
  const { terminateStaffAsync, isPending } = useTerminateStaff();

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('staff.terminate.title')}
      description={t('staff.terminate.description', {
        name: `${staffMember.firstName} ${staffMember.lastName}`,
      })}
      confirmLabel={t('staff.terminate.confirm')}
      cancelLabel={t('actions.cancel')}
      confirmVariant="destructive"
      isPending={isPending}
      // A 403 (terminating yourself) already surfaced via the interceptor.
      onConfirm={() =>
        settle(terminateStaffAsync({ staffId: staffMember.personId }))
      }
    />
  );
}

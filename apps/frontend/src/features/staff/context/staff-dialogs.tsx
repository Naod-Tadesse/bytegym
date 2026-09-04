import { ResetPasswordDialog } from '../actions/reset-password-dialog';
import { TerminateStaffDialog } from '../actions/terminate-staff';
import { useStaffContext } from './staff-context';

/** Single mount point for every staff dialog, so rows stay presentational. */
export function StaffDialogs() {
  const { open, setOpen, currentRow, setCurrentRow } = useStaffContext();

  if (!currentRow) return null;

  const close = (isOpen: boolean) => {
    if (isOpen) return;
    setOpen(null);
    setCurrentRow(null);
  };

  return (
    <>
      <TerminateStaffDialog
        // Keyed by row: retargeting remounts with the right state.
        key={`terminate-${currentRow.userId}`}
        open={open === 'terminate'}
        onOpenChange={close}
        staffMember={currentRow}
      />
      <ResetPasswordDialog
        key={`reset-${currentRow.userId}`}
        open={open === 'resetPassword'}
        onOpenChange={close}
        staffMember={currentRow}
      />
    </>
  );
}

import { TerminateStaffDialog } from '../actions/terminate-staff';
import { useStaffContext } from './staff-context';

/** Single mount point for every staff dialog, so rows stay presentational. */
export function StaffDialogs() {
  const { open, setOpen, currentRow, setCurrentRow } = useStaffContext();

  if (!currentRow) return null;

  return (
    <TerminateStaffDialog
      key={`terminate-${currentRow.userId}`}
      open={open === 'terminate'}
      onOpenChange={(isOpen) => {
        if (isOpen) return;
        setOpen(null);
        setCurrentRow(null);
      }}
      staffMember={currentRow}
    />
  );
}

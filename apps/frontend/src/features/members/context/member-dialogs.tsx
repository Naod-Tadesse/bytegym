import { DeleteMemberDialog } from '../actions/delete-member';
import { SuspendMemberDialog } from '../actions/suspend-member';
import { useMemberContext } from './member-context';

/** Single mount point for every member dialog, so rows stay presentational. */
export function MemberDialogs() {
  const { open, setOpen, currentRow, setCurrentRow } = useMemberContext();

  if (!currentRow) return null;

  const close = (isOpen: boolean) => {
    if (isOpen) return;
    setOpen(null);
    setCurrentRow(null);
  };

  return (
    <>
      <SuspendMemberDialog
        // Keyed by row: retargeting remounts with the right state.
        key={`suspend-${currentRow.personId}`}
        open={open === 'suspend'}
        onOpenChange={close}
        member={currentRow}
      />
      <DeleteMemberDialog
        key={`delete-${currentRow.personId}`}
        open={open === 'delete'}
        onOpenChange={close}
        member={currentRow}
      />
    </>
  );
}

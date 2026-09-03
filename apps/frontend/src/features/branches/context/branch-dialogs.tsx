import { DeactivateBranchDialog } from '../actions/deactivate-branch';
import { useBranchContext } from './branch-context';

/** Single mount point for every branch dialog, so rows stay presentational. */
export function BranchDialogs() {
  const { open, setOpen, currentRow, setCurrentRow } = useBranchContext();

  if (!currentRow) return null;

  return (
    <DeactivateBranchDialog
      // Keyed by row: reopening on another branch remounts with fresh state.
      key={`deactivate-${currentRow.id}`}
      open={open === 'deactivate'}
      onOpenChange={(isOpen) => {
        if (isOpen) return;
        setOpen(null);
        setCurrentRow(null);
      }}
      branch={currentRow}
    />
  );
}

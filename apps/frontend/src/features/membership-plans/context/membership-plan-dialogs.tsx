import { RetirePlanDialog } from '../actions/retire-plan';
import { useMembershipPlanContext } from './membership-plan-context';

/** Single mount point for every plan dialog, so rows stay presentational. */
export function MembershipPlanDialogs() {
  const { open, setOpen, currentRow, setCurrentRow } =
    useMembershipPlanContext();

  if (!currentRow) return null;

  return (
    <RetirePlanDialog
      // Keyed by row: reopening on another plan remounts with fresh state.
      key={`retire-${currentRow.id}`}
      open={open === 'retire'}
      onOpenChange={(isOpen) => {
        if (isOpen) return;
        setOpen(null);
        setCurrentRow(null);
      }}
      plan={currentRow}
    />
  );
}

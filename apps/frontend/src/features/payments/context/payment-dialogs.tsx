import { VoidPaymentDialog } from '../actions/void-payment-dialog';
import { usePaymentContext } from './payment-context';

/** Single mount point for every payment dialog, so rows stay presentational. */
export function PaymentDialogs() {
  const { open, setOpen, currentRow, setCurrentRow } = usePaymentContext();

  if (!currentRow) return null;

  const close = (isOpen: boolean) => {
    if (isOpen) return;
    setOpen(null);
    setCurrentRow(null);
  };

  return (
    <VoidPaymentDialog
      // Keyed by row: retargeting remounts with an empty reason rather than
      // carrying the last one over to a different payment.
      key={`void-${currentRow.id}`}
      open={open === 'void'}
      onOpenChange={close}
      payment={currentRow}
    />
  );
}

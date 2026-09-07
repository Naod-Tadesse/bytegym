import { createContext, useContext, useState, type ReactNode } from 'react';

import type { Payment } from '../data/types';

/**
 * One dialog kind. There is no create here — a payment is always taken against
 * a member, so it is recorded from the member's own page, and no edit and no
 * delete: a mistake is voided, which keeps the row.
 */
export type PaymentDialogType = 'void';

interface PaymentContextValue {
  open: PaymentDialogType | null;
  setOpen: (dialog: PaymentDialogType | null) => void;
  currentRow: Payment | null;
  setCurrentRow: (row: Payment | null) => void;
}

const PaymentContext = createContext<PaymentContextValue | null>(null);

export function PaymentProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<PaymentDialogType | null>(null);
  const [currentRow, setCurrentRow] = useState<Payment | null>(null);

  return (
    <PaymentContext.Provider
      value={{ open, setOpen, currentRow, setCurrentRow }}
    >
      {children}
    </PaymentContext.Provider>
  );
}

export function usePaymentContext() {
  const context = useContext(PaymentContext);
  if (!context) {
    throw new Error('usePaymentContext must be used inside <PaymentProvider>');
  }
  return context;
}

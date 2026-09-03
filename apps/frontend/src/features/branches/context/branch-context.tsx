import { createContext, useContext, useState, type ReactNode } from 'react';

import type { Branch } from '../data/types';

/** Only one dialog kind here — create and edit are pages. */
export type BranchDialogType = 'deactivate';

interface BranchContextValue {
  open: BranchDialogType | null;
  setOpen: (dialog: BranchDialogType | null) => void;
  currentRow: Branch | null;
  setCurrentRow: (row: Branch | null) => void;
}

const BranchContext = createContext<BranchContextValue | null>(null);

export function BranchProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<BranchDialogType | null>(null);
  const [currentRow, setCurrentRow] = useState<Branch | null>(null);

  return (
    <BranchContext.Provider
      value={{ open, setOpen, currentRow, setCurrentRow }}
    >
      {children}
    </BranchContext.Provider>
  );
}

export function useBranchContext() {
  const context = useContext(BranchContext);
  if (!context) {
    throw new Error('useBranchContext must be used inside <BranchProvider>');
  }
  return context;
}

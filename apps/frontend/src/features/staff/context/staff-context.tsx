import { createContext, useContext, useState, type ReactNode } from 'react';

import type { StaffListItem } from '../data/types';

/**
 * Create and edit are pages; terminate is a confirm, so it stays a dialog.
 *
 * `grantAccess` is the one credential action still here, because it is the
 * only one whose subject is not yet a user — Users cannot list someone who has
 * no login. Ongoing management (reset, disable, revoke) lives there instead.
 */
export type StaffDialogType = 'terminate' | 'grantAccess';

interface StaffContextValue {
  open: StaffDialogType | null;
  setOpen: (dialog: StaffDialogType | null) => void;
  currentRow: StaffListItem | null;
  setCurrentRow: (row: StaffListItem | null) => void;
}

const StaffContext = createContext<StaffContextValue | null>(null);

export function StaffProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<StaffDialogType | null>(null);
  const [currentRow, setCurrentRow] = useState<StaffListItem | null>(null);

  return (
    <StaffContext.Provider value={{ open, setOpen, currentRow, setCurrentRow }}>
      {children}
    </StaffContext.Provider>
  );
}

export function useStaffContext() {
  const context = useContext(StaffContext);
  if (!context) {
    throw new Error('useStaffContext must be used inside <StaffProvider>');
  }
  return context;
}

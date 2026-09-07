import { createContext, useContext, useState, type ReactNode } from 'react';

import type { MemberListItem } from '../data/types';

/**
 * Create and edit are pages (seven edit fields). Suspend and delete are both
 * confirmations, so they stay dialogs.
 */
export type MemberDialogType = 'suspend' | 'delete';

interface MemberContextValue {
  open: MemberDialogType | null;
  setOpen: (dialog: MemberDialogType | null) => void;
  currentRow: MemberListItem | null;
  setCurrentRow: (row: MemberListItem | null) => void;
}

const MemberContext = createContext<MemberContextValue | null>(null);

export function MemberProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<MemberDialogType | null>(null);
  const [currentRow, setCurrentRow] = useState<MemberListItem | null>(null);

  return (
    <MemberContext.Provider
      value={{ open, setOpen, currentRow, setCurrentRow }}
    >
      {children}
    </MemberContext.Provider>
  );
}

export function useMemberContext() {
  const context = useContext(MemberContext);
  if (!context) {
    throw new Error('useMemberContext must be used inside <MemberProvider>');
  }
  return context;
}

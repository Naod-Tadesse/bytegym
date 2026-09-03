import { createContext, useContext, useState, type ReactNode } from 'react';

import type { Role } from '../data/types';

/** Roles have ≤ 3 inputs, so create and edit are dialogs rather than pages. */
export type RoleDialogType = 'create' | 'edit' | 'delete';

interface RoleContextValue {
  open: RoleDialogType | null;
  setOpen: (dialog: RoleDialogType | null) => void;
  currentRow: Role | null;
  setCurrentRow: (row: Role | null) => void;
}

const RoleContext = createContext<RoleContextValue | null>(null);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<RoleDialogType | null>(null);
  const [currentRow, setCurrentRow] = useState<Role | null>(null);

  return (
    <RoleContext.Provider value={{ open, setOpen, currentRow, setCurrentRow }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRoleContext() {
  const context = useContext(RoleContext);
  if (!context) {
    throw new Error('useRoleContext must be used inside <RoleProvider>');
  }
  return context;
}

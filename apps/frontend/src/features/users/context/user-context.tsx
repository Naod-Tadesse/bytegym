import { createContext, useContext, useState, type ReactNode } from 'react';

import type { UserListItem } from '../data/types';

/**
 * Every account action here is ≤ 3 inputs, so all of them are dialogs, and all
 * operate on a row. Granting access is NOT here: its subject has no login yet,
 * so this list cannot show them — it lives on the Staff row menu instead.
 */
export type UserDialogType =
  | 'editAccess'
  | 'resetPassword'
  | 'toggleLogin'
  | 'revokeAccess';

interface UserContextValue {
  open: UserDialogType | null;
  setOpen: (dialog: UserDialogType | null) => void;
  currentRow: UserListItem | null;
  setCurrentRow: (row: UserListItem | null) => void;
}

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<UserDialogType | null>(null);
  const [currentRow, setCurrentRow] = useState<UserListItem | null>(null);

  return (
    <UserContext.Provider value={{ open, setOpen, currentRow, setCurrentRow }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUserContext() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUserContext must be used inside <UserProvider>');
  }
  return context;
}

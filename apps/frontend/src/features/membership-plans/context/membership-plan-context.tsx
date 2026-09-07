import { createContext, useContext, useState, type ReactNode } from 'react';

import type { MembershipPlan } from '../data/types';

/** Only one dialog kind here — create and edit are pages. */
export type MembershipPlanDialogType = 'retire';

interface MembershipPlanContextValue {
  open: MembershipPlanDialogType | null;
  setOpen: (dialog: MembershipPlanDialogType | null) => void;
  currentRow: MembershipPlan | null;
  setCurrentRow: (row: MembershipPlan | null) => void;
}

const MembershipPlanContext = createContext<MembershipPlanContextValue | null>(
  null,
);

export function MembershipPlanProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<MembershipPlanDialogType | null>(null);
  const [currentRow, setCurrentRow] = useState<MembershipPlan | null>(null);

  return (
    <MembershipPlanContext.Provider
      value={{ open, setOpen, currentRow, setCurrentRow }}
    >
      {children}
    </MembershipPlanContext.Provider>
  );
}

export function useMembershipPlanContext() {
  const context = useContext(MembershipPlanContext);
  if (!context) {
    throw new Error(
      'useMembershipPlanContext must be used inside <MembershipPlanProvider>',
    );
  }
  return context;
}

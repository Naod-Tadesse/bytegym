import type { TableState } from '@/services/pagination';

export interface Branch {
  id: string;
  name: string;
  addressLine: string | null;
  city: string | null;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type BranchTableState = TableState;

import type { TableState } from '@/services/pagination';

export interface Role {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Permission {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  group: string;
}

/** GET /api/roles/:id attaches the role's current grants. */
export interface RoleDetail extends Role {
  permissions: Permission[];
}

export type RoleTableState = TableState;

/** What PUT /api/roles/:id/permissions reports back. */
export interface SyncPermissionsResult {
  added: number;
  removed: number;
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { toast } from '@/components/ui/toast';
import ApiClient from '@/services/api-client';
import {
  toPaginationInfo,
  type PaginatedResponse,
} from '@/services/pagination';
import type {
  Permission,
  Role,
  RoleDetail,
  RoleTableState,
  SyncPermissionsResult,
} from '../data/types';

const rolesClient = new ApiClient('/api/roles');
// Sits on its own path, and only ever feeds role editing.
const permissionsClient = new ApiClient('/api/permissions');

// ===== Queries =====

export function useRoles(tableState: RoleTableState) {
  const query = useQuery({
    queryKey: ['roles', 'list', tableState],
    queryFn: () =>
      rolesClient.get<PaginatedResponse<Role>>('', {
        params: {
          page: tableState.page,
          limit: tableState.limit,
          ...(tableState.search ? { search: tableState.search } : {}),
        },
      }),
  });

  return {
    roles: query.data?.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    paginationInfo: toPaginationInfo(query.data?.meta, tableState),
  };
}

/** Every role, for the staff form's role picker. */
export function useRoleOptions() {
  const query = useQuery({
    queryKey: ['roles', 'options'],
    queryFn: () =>
      rolesClient.get<PaginatedResponse<Role>>('', {
        params: { page: 1, limit: 100 },
      }),
  });

  return {
    options: (query.data?.data ?? [])
      .filter((role) => role.isActive)
      .map((role) => ({ label: role.name, value: role.id })),
    isLoading: query.isLoading,
  };
}

export function useRole(roleId: string) {
  const query = useQuery({
    queryKey: ['roles', 'detail', roleId],
    queryFn: () => rolesClient.get<RoleDetail>(`/${roleId}`),
    enabled: !!roleId,
  });

  return { role: query.data, isLoading: query.isLoading };
}

/** The full catalogue, already ordered by group then name by the backend. */
export function usePermissionCatalogue() {
  const query = useQuery({
    queryKey: ['permissions'],
    queryFn: () => permissionsClient.get<Permission[]>(''),
    // The catalogue only changes when the app is redeployed.
    staleTime: 5 * 60 * 1000,
  });

  return { permissions: query.data ?? [], isLoading: query.isLoading };
}

// ===== Mutations =====

/** Dialog-driven, so success closes the caller rather than navigating. */
export function useCreateRole(onSuccess?: () => void) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: Partial<Role>) => rolesClient.post<Role>('', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      toast.add({ title: 'Role created', type: 'success' });
      onSuccess?.();
    },
  });

  return {
    createRoleAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
  };
}

export function useUpdateRole(onSuccess?: () => void) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ roleId, data }: { roleId: string; data: Partial<Role> }) =>
      rolesClient.patch<Role>(`/${roleId}`, data),
    onSuccess: (_, { roleId }) => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      queryClient.invalidateQueries({ queryKey: ['roles', 'detail', roleId] });
      toast.add({ title: 'Role updated', type: 'success' });
      onSuccess?.();
    },
  });

  return {
    updateRoleAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
  };
}

export function useDeleteRole() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ roleId }: { roleId: string }) =>
      rolesClient.delete(`/${roleId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['roles'] });
      // Deleting a role revokes the sessions of everyone who held it.
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      toast.add({ title: 'Role deleted', type: 'success' });
    },
  });

  return {
    deleteRoleAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
  };
}

/** Sends the whole desired set; the backend works out the diff. */
export function useSyncRolePermissions(onSuccess?: () => void) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({
      roleId,
      permissionIds,
    }: {
      roleId: string;
      permissionIds: string[];
    }) =>
      rolesClient.put<SyncPermissionsResult>(`/${roleId}/permissions`, {
        permissionIds,
      }),
    onSuccess: (result, { roleId }) => {
      queryClient.invalidateQueries({ queryKey: ['roles', 'detail', roleId] });
      // The signed-in user may have just changed their own access.
      queryClient.invalidateQueries({ queryKey: ['auth', 'me'] });
      toast.add({
        title: `Permissions saved — ${result.added} added, ${result.removed} removed`,
        type: 'success',
      });
      onSuccess?.();
    },
  });

  return {
    syncPermissionsAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
  };
}

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';

import { toast } from '@/components/ui/toast';
import ApiClient from '@/services/api-client';
import {
  toPaginationInfo,
  type PaginatedResponse,
} from '@/services/pagination';
import type {
  DataScope,
  StaffDetail,
  StaffListItem,
  StaffTableState,
} from '../data/types';

const apiClient = new ApiClient('/api/staff');

/** The write payloads, mirroring CreateStaffDto / UpdateStaffDto. */
export interface CreateStaffPayload {
  firstName: string;
  lastName: string;
  phone: string;
  /**
   * Omit it entirely to hire someone with no login — no account row is
   * created, so there is nothing to authenticate against. A job title whose
   * `canHaveAccount` is false rejects one with a 400, and so does any
   * `roleIds` sent without it: roles hang off the account.
   */
  password?: string;
  dateOfBirth?: string;
  gender?: string;
  primaryBranchId: string;
  jobTitleId: string;
  hiredOn: string;
  dataScope: DataScope;
  roleIds: string[];
}

/**
 * Employment only. `dataScope` and `roleIds` are deliberately absent: they are
 * access decisions, and the API contract for changing them is owned by
 * `features/users`. The endpoint still accepts them — this type is what stops
 * the HR form from quietly sending one.
 */
export type UpdateStaffPayload = Partial<
  Omit<CreateStaffPayload, 'phone' | 'password' | 'dataScope' | 'roleIds'>
> & {
  employmentStatus?: StaffListItem['employmentStatus'];
};

// ===== Queries =====

export function useStaffList(tableState: StaffTableState) {
  const query = useQuery({
    queryKey: ['staff', 'list', tableState],
    queryFn: () =>
      apiClient.get<PaginatedResponse<StaffListItem>>('', {
        params: {
          page: tableState.page,
          limit: tableState.limit,
          ...(tableState.search ? { search: tableState.search } : {}),
        },
      }),
  });

  return {
    staff: query.data?.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    paginationInfo: toPaginationInfo(query.data?.meta, tableState),
  };
}

export function useStaffMember(staffId: string) {
  const query = useQuery({
    queryKey: ['staff', 'detail', staffId],
    queryFn: () => apiClient.get<StaffDetail>(`/${staffId}`),
    enabled: !!staffId,
  });

  return { staffMember: query.data, isLoading: query.isLoading };
}

// ===== Mutations =====

export function useCreateStaff() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const mutation = useMutation({
    mutationFn: (data: CreateStaffPayload) => apiClient.post('', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      // Hiring with a password creates the account too, so they appear on the
      // users list immediately.
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.add({ title: 'Staff member created', type: 'success' });
      navigate({ to: '/staff' });
    },
  });

  return { createStaff: mutation.mutate, isPending: mutation.isPending };
}

export function useUpdateStaff() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const mutation = useMutation({
    mutationFn: ({
      staffId,
      data,
    }: {
      staffId: string;
      data: UpdateStaffPayload;
    }) => apiClient.patch<StaffDetail>(`/${staffId}`, data),
    onSuccess: (_, { staffId }) => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      queryClient.invalidateQueries({ queryKey: ['staff', 'detail', staffId] });
      toast.add({ title: 'Staff member updated', type: 'success' });
      // Edit has a detail page to return to, unlike branches.
      navigate({ to: '/staff/$staffId', params: { staffId } });
    },
  });

  return { updateStaff: mutation.mutate, isPending: mutation.isPending };
}

/**
 * Creates the account row that IS the right to sign in — the transition from
 * employee to user. Ongoing credential management lives in `features/users`;
 * this is here because Users cannot list someone who has no login yet.
 *
 * 400s when the job title has `canHaveAccount: false` (a cleaner) or they are
 * terminated; 409s when they already have one. The interceptor toasts all
 * three, so nothing is pre-checked.
 */
export function useGrantStaffAccess(onSuccess?: () => void) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({
      staffId,
      password,
      roleIds,
    }: {
      staffId: string;
      password: string;
      roleIds: string[];
    }) =>
      apiClient.post<{ id: string }>(`/${staffId}/access`, {
        password,
        roleIds,
      }),
    onSuccess: (_, { staffId }) => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      queryClient.invalidateQueries({ queryKey: ['staff', 'detail', staffId] });
      // They now appear on the Users list, which they did not before.
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.add({ title: 'System access granted', type: 'success' });
      onSuccess?.();
    },
  });

  return {
    grantAccessAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
  };
}

export function useTerminateStaff() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ staffId }: { staffId: string }) =>
      apiClient.delete(`/${staffId}`),
    onSuccess: (_, { staffId }) => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      queryClient.invalidateQueries({ queryKey: ['staff', 'detail', staffId] });
      // Terminating deletes the account outright, so they drop off the users
      // list — it must not keep showing them as able to sign in.
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.add({ title: 'Staff member terminated', type: 'success' });
    },
  });

  return {
    terminateStaffAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
  };
}

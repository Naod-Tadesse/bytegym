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
  password: string;
  dateOfBirth?: string;
  gender?: string;
  staffCode: string;
  primaryBranchId: string;
  jobTitle: string;
  hiredOn: string;
  dataScope: DataScope;
  roleIds: string[];
}

export type UpdateStaffPayload = Partial<
  Omit<CreateStaffPayload, 'phone' | 'password' | 'staffCode'>
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

/** Administrative reset — no current password, and it signs them out. */
export function useResetStaffPassword(onSuccess?: () => void) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({
      staffId,
      newPassword,
    }: {
      staffId: string;
      newPassword: string;
    }) => apiClient.patch(`/${staffId}/password`, { newPassword }),
    onSuccess: () => {
      // Nothing on the staff row changes, but their sessions are now revoked.
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      toast.add({
        title: 'Password reset — they must sign in again',
        type: 'success',
      });
      onSuccess?.();
    },
  });

  return {
    resetPasswordAsync: mutation.mutateAsync,
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
      toast.add({ title: 'Staff member terminated', type: 'success' });
    },
  });

  return {
    terminateStaffAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
  };
}

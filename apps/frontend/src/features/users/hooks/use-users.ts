import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { toast } from '@/components/ui/toast';
import type { AccountStatus, DataScope } from '@/features/staff/data/types';
import ApiClient from '@/services/api-client';
import {
  toPaginationInfo,
  type PaginatedResponse,
} from '@/services/pagination';
import type { UserListItem, UserTableState } from '../data/types';

// The hooks file IS the api layer — no separate api/ folder, per the ekos
// pattern. There is no /api/users: an account hangs off a staff member, so
// every call here is a staff endpoint filtered or scoped to the credential.
const apiClient = new ApiClient('/api/staff');

/** Every mutation here changes both lists, so both are always dropped. */
function invalidateAccess(
  queryClient: ReturnType<typeof useQueryClient>,
  staffId?: string,
) {
  queryClient.invalidateQueries({ queryKey: ['users'] });
  // The staff roster carries a read-only Access column fed by the same rows.
  queryClient.invalidateQueries({ queryKey: ['staff'] });
  if (staffId) {
    queryClient.invalidateQueries({ queryKey: ['staff', 'detail', staffId] });
  }
}

// ===== Queries =====

/** Only staff who can sign in. `hasAccount=true` is what makes this a list of users. */
export function useUsers(tableState: UserTableState) {
  const query = useQuery({
    queryKey: ['users', 'list', tableState],
    queryFn: () =>
      apiClient.get<PaginatedResponse<UserListItem>>('', {
        params: {
          page: tableState.page,
          limit: tableState.limit,
          hasAccount: true,
          ...(tableState.search ? { search: tableState.search } : {}),
        },
      }),
  });

  return {
    users: query.data?.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    paginationInfo: toPaginationInfo(query.data?.meta, tableState),
  };
}

// ===== Mutations =====

// Granting access is NOT here. Its subject has no login yet, so this list
// cannot show them — it lives on the Staff row menu, as useGrantStaffAccess.

/** Administrative reset — no current password, and it signs them out. */
export function useResetPassword(onSuccess?: () => void) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({
      staffId,
      newPassword,
    }: {
      staffId: string;
      newPassword: string;
    }) =>
      apiClient.patch<{ id: string }>(`/${staffId}/password`, {
        newPassword,
      }),
    onSuccess: (_, { staffId }) => {
      // No column changes, but their sessions are now revoked.
      invalidateAccess(queryClient, staffId);
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

/**
 * The reversible suspension. `disabled` refuses sign-in and kills their live
 * sessions but KEEPS the password, so flipping back to `active` hands back the
 * credential they already know. Contrast `useRevokeAccess`, which deletes it.
 *
 * 403s when you disable your own account.
 */
export function useSetLoginStatus() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({
      staffId,
      status,
    }: {
      staffId: string;
      status: AccountStatus;
    }) => apiClient.patch<{ id: string }>(`/${staffId}/access`, { status }),
    onSuccess: (_, { staffId, status }) => {
      invalidateAccess(queryClient, staffId);
      toast.add({
        // Full literals, never built from `status` — the message is not a key,
        // but the same rule keeps it greppable.
        title: status === 'disabled' ? 'Login disabled' : 'Login enabled',
        type: 'success',
      });
    },
  });

  return {
    setLoginStatusAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
  };
}

/**
 * What a signed-in staff member may reach: their roles, and how far their
 * queries see.
 *
 * Answers to `role.assign`, not `staff.update` — deliberately, so access can
 * be managed without also being able to edit names and job titles. That is the
 * whole reason this lives here rather than on the staff edit form.
 *
 * `roleIds` is a FULL REPLACE: anything omitted from the array is revoked.
 * Both fields are baked into the access token, so either changing signs them
 * out.
 */
export function useSetAuthorization(onSuccess?: () => void) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({
      staffId,
      roleIds,
      dataScope,
    }: {
      staffId: string;
      roleIds: string[];
      dataScope?: DataScope;
    }) =>
      apiClient.patch<UserListItem>(`/${staffId}/authorization`, {
        roleIds,
        ...(dataScope ? { dataScope } : {}),
      }),
    onSuccess: (_, { staffId }) => {
      invalidateAccess(queryClient, staffId);
      toast.add({
        title: 'Access updated — they must sign in again',
        type: 'success',
      });
      onSuccess?.();
    },
  });

  return {
    setAuthorizationAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
  };
}

/**
 * Deletes the account row and every session with it. Their role grants go too,
 * since roles hang off the account — they stay on the roster and keep their
 * employment history, they simply cannot sign in.
 *
 * 403s when you revoke your own access.
 */
export function useRevokeAccess() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ staffId }: { staffId: string }) =>
      apiClient.delete<{ id: string }>(`/${staffId}/access`),
    onSuccess: (_, { staffId }) => {
      invalidateAccess(queryClient, staffId);
      toast.add({ title: 'System access revoked', type: 'success' });
    },
  });

  return {
    revokeAccessAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
  };
}

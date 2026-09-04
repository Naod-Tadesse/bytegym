import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';

import { toast } from '@/components/ui/toast';
import ApiClient from '@/services/api-client';
import {
  toPaginationInfo,
  type PaginatedResponse,
} from '@/services/pagination';
import type { Branch, BranchTableState } from '../data/types';

const apiClient = new ApiClient('/api/branches');

// ===== Queries =====

export function useBranches(tableState: BranchTableState) {
  const query = useQuery({
    queryKey: ['branches', 'list', tableState],
    queryFn: () =>
      apiClient.get<PaginatedResponse<Branch>>('', {
        params: {
          page: tableState.page,
          limit: tableState.limit,
          ...(tableState.search ? { search: tableState.search } : {}),
        },
      }),
  });

  return {
    branches: query.data?.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    paginationInfo: toPaginationInfo(query.data?.meta, tableState),
  };
}

const OPTIONS_PAGE_SIZE = 20;

/**
 * Feeds a `DataCombobox`. Branches are a paginated endpoint, so this pages
 * and searches server-side rather than pulling one oversized page and hoping
 * it covers everything.
 *
 * `search` should already be debounced by the caller.
 */
export function useBranchOptions(search?: string) {
  const query = useInfiniteQuery({
    queryKey: ['branches', 'options', search ?? ''],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      apiClient.get<PaginatedResponse<Branch>>('', {
        params: {
          page: pageParam,
          limit: OPTIONS_PAGE_SIZE,
          ...(search ? { search } : {}),
        },
      }),
    getNextPageParam: (lastPage) =>
      lastPage.meta.page < lastPage.meta.totalPages
        ? lastPage.meta.page + 1
        : undefined,
  });

  return {
    options: (query.data?.pages ?? [])
      .flatMap((page) => page.data)
      // Retired branches stay assignable to nobody new.
      .filter((branch) => branch.isActive)
      .map((branch) => ({ label: branch.name, value: branch.id })),
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage,
    isLoading: query.isLoading || query.isFetchingNextPage,
  };
}

export function useBranch(branchId: string) {
  const query = useQuery({
    queryKey: ['branches', 'detail', branchId],
    queryFn: () => apiClient.get<Branch>(`/${branchId}`),
    enabled: !!branchId,
  });

  return { branch: query.data, isLoading: query.isLoading };
}

// ===== Mutations =====

export function useCreateBranch() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const mutation = useMutation({
    mutationFn: (data: Partial<Branch>) => apiClient.post<Branch>('', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      toast.add({ title: 'Branch created', type: 'success' });
      navigate({ to: '/branches' });
    },
  });

  return {
    createBranch: mutation.mutate,
    isPending: mutation.isPending,
    error: mutation.error,
  };
}

export function useUpdateBranch() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const mutation = useMutation({
    mutationFn: ({
      branchId,
      data,
    }: {
      branchId: string;
      data: Partial<Branch>;
    }) => apiClient.patch<Branch>(`/${branchId}`, data),
    onSuccess: (_, { branchId }) => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      queryClient.invalidateQueries({
        queryKey: ['branches', 'detail', branchId],
      });
      toast.add({ title: 'Branch updated', type: 'success' });
      navigate({ to: '/branches' });
    },
  });

  return {
    updateBranch: mutation.mutate,
    isPending: mutation.isPending,
    error: mutation.error,
  };
}

export function useDeactivateBranch() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ branchId }: { branchId: string }) =>
      apiClient.delete(`/${branchId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['branches'] });
      toast.add({ title: 'Branch deactivated', type: 'success' });
    },
  });

  return {
    deactivateBranchAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
  };
}

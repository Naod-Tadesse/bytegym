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
import type {
  MemberDetail,
  MemberListItem,
  MemberTableState,
} from '../data/types';

// The hooks file IS the api layer — no separate api/ folder.
const apiClient = new ApiClient('/api/members');

/** Mirrors CreateMemberDto. */
export interface CreateMemberPayload {
  firstName: string;
  lastName: string;
  phone: string;
  dateOfBirth?: string;
  gender?: string;
  branchId: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
}

/**
 * Mirrors UpdateMemberDto: every field optional, and no `phone` — it is
 * immutable once the person exists, exactly as on staff.
 */
export type UpdateMemberPayload = Partial<Omit<CreateMemberPayload, 'phone'>>;

// ===== Queries =====

export function useMembers(tableState: MemberTableState) {
  const query = useQuery({
    queryKey: ['members', 'list', tableState],
    queryFn: () =>
      apiClient.get<PaginatedResponse<MemberListItem>>('', {
        params: {
          page: tableState.page,
          limit: tableState.limit,
          ...(tableState.search ? { search: tableState.search } : {}),
        },
      }),
  });

  return {
    members: query.data?.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    paginationInfo: toPaginationInfo(query.data?.meta, tableState),
  };
}

/** How many matches the front desk is shown at once. */
const SEARCH_LIMIT = 8;

/**
 * The front desk's member lookup, for the check-in screen.
 *
 * Deliberately not `useMembers` with a search term: this is a lookup, not a
 * list. Nothing is fetched until something is typed, because an empty box
 * returning page one of the whole roster would present eight arbitrary people
 * as if they were matches — and the next thing that happens on that screen is
 * someone being let through the door.
 *
 * `enabled` exists because the endpoint is `member.list`: a receptionist who
 * can record check-ins but cannot list members would otherwise fire a request
 * that only ever 403s, toasting on every keystroke.
 */
export function useMemberSearch(search: string, enabled = true) {
  const term = search.trim();

  const query = useQuery({
    queryKey: ['members', 'search', term],
    queryFn: () =>
      apiClient.get<PaginatedResponse<MemberListItem>>('', {
        params: { page: 1, limit: SEARCH_LIMIT, search: term },
      }),
    enabled: enabled && term.length > 0,
  });

  return {
    members: query.data?.data ?? [],
    /** Matches in total, which may exceed the {@link SEARCH_LIMIT} shown. */
    total: query.data?.meta.total ?? 0,
    /** `isFetching`, not `isLoading`: a new term must show as loading too. */
    isLoading: query.isFetching,
    /** Whether a term has been typed at all — "no matches" needs to know. */
    hasSearched: term.length > 0,
  };
}

const OPTIONS_PAGE_SIZE = 20;

/**
 * Feeds a `DataCombobox` — the member picker on the attendance filters.
 *
 * Deliberately not {@link useMemberSearch}, which is a lookup: it caps at eight
 * matches on purpose and the desk screen prints "showing 8 of 23" underneath to
 * own the truncation. A combobox has nowhere to print that, so a fixed page
 * would silently drop the member being looked for — the exact failure the
 * combobox rule exists to prevent. This pages instead, like `useBranchOptions`.
 *
 * Unlike the desk's lookup this fetches with no term: a filter opens on a list
 * you scroll, not on a blank prompt, and there is nothing at stake here — the
 * next thing that happens is a table filters, not a door opens.
 *
 * The endpoint is `member.list`, and this fetches on mount — so a caller must
 * not render the picker at all unless the user holds that permission, or every
 * keystroke fires a request that only ever 403s and toasts.
 *
 * `search` should already be debounced by the caller.
 */
export function useMemberOptions(search?: string) {
  const query = useInfiniteQuery({
    queryKey: ['members', 'options', search ?? ''],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      apiClient.get<PaginatedResponse<MemberListItem>>('', {
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
      // The code goes in the label, not a second column: it is how a member is
      // told apart from their namesake, and a combobox option is one string.
      .map((member) => ({
        label: `${member.firstName} ${member.lastName} · ${member.memberCode}`,
        value: member.personId,
      })),
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage,
    isLoading: query.isLoading || query.isFetchingNextPage,
  };
}

export function useMember(memberId: string) {
  const query = useQuery({
    queryKey: ['members', 'detail', memberId],
    queryFn: () => apiClient.get<MemberDetail>(`/${memberId}`),
    enabled: !!memberId,
  });

  return { member: query.data, isLoading: query.isLoading };
}

// ===== Mutations =====

export function useCreateMember() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const mutation = useMutation({
    mutationFn: (data: CreateMemberPayload) =>
      apiClient.post<MemberDetail>('', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      toast.add({ title: 'Member created', type: 'success' });
      navigate({ to: '/members' });
    },
  });

  return { createMember: mutation.mutate, isPending: mutation.isPending };
}

export function useUpdateMember() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const mutation = useMutation({
    mutationFn: ({
      memberId,
      data,
    }: {
      memberId: string;
      data: UpdateMemberPayload;
    }) => apiClient.patch<MemberDetail>(`/${memberId}`, data),
    onSuccess: (_, { memberId }) => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      queryClient.invalidateQueries({
        queryKey: ['members', 'detail', memberId],
      });
      toast.add({ title: 'Member updated', type: 'success' });
      // Back to the list rather than the detail page: editing is reachable
      // with `member.update` alone, and the detail route needs `member.read`.
      navigate({ to: '/members' });
    },
  });

  return { updateMember: mutation.mutate, isPending: mutation.isPending };
}

/**
 * Suspension is its own endpoint rather than a field on PATCH: barring someone
 * from the premises is a decision, not an edit, and it must not ride along in
 * a form save that only meant to fix a spelling.
 */
export function useSetMemberSuspension() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({
      memberId,
      isSuspended,
    }: {
      memberId: string;
      isSuspended: boolean;
    }) =>
      apiClient.patch<MemberDetail>(`/${memberId}/suspension`, { isSuspended }),
    onSuccess: (_, { memberId, isSuspended }) => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      queryClient.invalidateQueries({
        queryKey: ['members', 'detail', memberId],
      });
      toast.add({
        title: isSuspended ? 'Member suspended' : 'Suspension lifted',
        type: 'success',
      });
    },
  });

  return {
    setSuspensionAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
  };
}

export function useDeleteMember() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ memberId }: { memberId: string }) =>
      apiClient.delete<{ id: string }>(`/${memberId}`),
    onSuccess: (_, { memberId }) => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      queryClient.invalidateQueries({
        queryKey: ['members', 'detail', memberId],
      });
      toast.add({ title: 'Member deleted', type: 'success' });
    },
  });

  return {
    deleteMemberAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
  };
}

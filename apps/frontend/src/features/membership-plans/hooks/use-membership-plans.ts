import { useMemo } from 'react';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';

import { toast } from '@/components/ui/toast';
import { formatBirr } from '@/lib/format';
import ApiClient from '@/services/api-client';
import {
  toPaginationInfo,
  type PaginatedResponse,
} from '@/services/pagination';
import type { MembershipPlan, MembershipPlanTableState } from '../data/types';

// The hooks file IS the api layer — no separate api/ folder.
const apiClient = new ApiClient('/api/membership-plans');

/** Mirrors `CreateMembershipPlanDto`. `price` is a decimal string, never a number. */
export interface CreateMembershipPlanPayload {
  name: string;
  description?: string;
  durationDays: number;
  price: string;
  /** Optional; the API defaults it to `"0"` when omitted. */
  registrationFee?: string;
  isActive?: boolean;
}

/** Mirrors `UpdateMembershipPlanDto` — every field optional. */
export type UpdateMembershipPlanPayload = Partial<CreateMembershipPlanPayload>;

// ===== Queries =====

export function useMembershipPlans(tableState: MembershipPlanTableState) {
  const query = useQuery({
    queryKey: ['membership-plans', 'list', tableState],
    queryFn: () =>
      apiClient.get<PaginatedResponse<MembershipPlan>>('', {
        params: {
          page: tableState.page,
          limit: tableState.limit,
          ...(tableState.search ? { search: tableState.search } : {}),
        },
      }),
  });

  return {
    plans: query.data?.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    paginationInfo: toPaginationInfo(query.data?.meta, tableState),
  };
}

const OPTIONS_PAGE_SIZE = 20;

/**
 * Feeds the sell-membership `DataCombobox`. Plans are a paginated endpoint, so
 * this pages and searches server-side rather than pulling one oversized page
 * and hoping it covers everything.
 *
 * `isActive: true` asks the server for sellable plans only; the client-side
 * filter repeats it because a retired plan reaching this list would be an
 * option the API refuses with a 400. `search` should already be debounced.
 *
 * Returns `planById` beside `options` for the same reason
 * `useJobTitleOptions` returns `canHaveAccountById`: a `DataComboboxOption` is
 * only `{value,label}`, and the sale dialog has to show a price breakdown for
 * whichever plan is picked.
 */
export function usePlanOptions(search?: string) {
  const query = useInfiniteQuery({
    queryKey: ['membership-plans', 'options', search ?? ''],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      apiClient.get<PaginatedResponse<MembershipPlan>>('', {
        params: {
          page: pageParam,
          limit: OPTIONS_PAGE_SIZE,
          isActive: true,
          ...(search ? { search } : {}),
        },
      }),
    getNextPageParam: (lastPage) =>
      lastPage.meta.page < lastPage.meta.totalPages
        ? lastPage.meta.page + 1
        : undefined,
  });

  const plans = useMemo(
    () =>
      (query.data?.pages ?? [])
        .flatMap((page) => page.data)
        .filter((plan) => plan.isActive),
    [query.data],
  );

  return {
    options: useMemo(
      () =>
        // The price is in the label because picking the wrong plan is a money
        // mistake, and the price is the thing that distinguishes two similar
        // names at the desk. The registration fee is not: it applies to some
        // buyers and not others, so it belongs in the breakdown, not the label.
        plans.map((plan) => ({
          label: `${plan.name} — ${formatBirr(plan.price)}`,
          value: plan.id,
        })),
      [plans],
    ),
    /**
     * The figures behind each option, keyed by plan id — `DataComboboxOption`
     * is only `{value,label}` and cannot carry them.
     *
     * Only plans on a loaded page are in here, so a search that pages the
     * chosen row away empties its entry: read it at render time to *display* a
     * breakdown, and never treat a miss as "no fee" in anything sent — the
     * server computes the real amount due from the plan row itself.
     */
    planById: useMemo(
      () => new Map(plans.map((plan) => [plan.id, plan])),
      [plans],
    ),
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage,
    isLoading: query.isLoading || query.isFetchingNextPage,
  };
}

export function useMembershipPlan(planId: string) {
  const query = useQuery({
    queryKey: ['membership-plans', 'detail', planId],
    queryFn: () => apiClient.get<MembershipPlan>(`/${planId}`),
    enabled: !!planId,
  });

  return { plan: query.data, isLoading: query.isLoading };
}

// ===== Mutations =====

export function useCreateMembershipPlan() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const mutation = useMutation({
    mutationFn: (data: CreateMembershipPlanPayload) =>
      apiClient.post<MembershipPlan>('', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['membership-plans'] });
      toast.add({ title: 'Plan created', type: 'success' });
      navigate({ to: '/membership-plans' });
    },
  });

  return { createPlan: mutation.mutate, isPending: mutation.isPending };
}

export function useUpdateMembershipPlan() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const mutation = useMutation({
    mutationFn: ({
      planId,
      data,
    }: {
      planId: string;
      data: UpdateMembershipPlanPayload;
    }) => apiClient.patch<MembershipPlan>(`/${planId}`, data),
    onSuccess: (_, { planId }) => {
      queryClient.invalidateQueries({ queryKey: ['membership-plans'] });
      queryClient.invalidateQueries({
        queryKey: ['membership-plans', 'detail', planId],
      });
      toast.add({ title: 'Plan updated', type: 'success' });
      navigate({ to: '/membership-plans' });
    },
  });

  return { updatePlan: mutation.mutate, isPending: mutation.isPending };
}

/**
 * Retiring is a `PATCH { isActive: false }`, not a delete — there is no
 * `plan.delete` permission and no DELETE route, because every membership ever
 * sold points at the row. It is the same call the edit page's switch makes, so
 * a retired plan is brought back from there.
 */
export function useRetireMembershipPlan() {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({ planId }: { planId: string }) =>
      apiClient.patch<MembershipPlan>(`/${planId}`, { isActive: false }),
    onSuccess: (_, { planId }) => {
      queryClient.invalidateQueries({ queryKey: ['membership-plans'] });
      queryClient.invalidateQueries({
        queryKey: ['membership-plans', 'detail', planId],
      });
      toast.add({ title: 'Plan retired', type: 'success' });
    },
  });

  return {
    retirePlanAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
  };
}

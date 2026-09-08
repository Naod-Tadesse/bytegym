import { useEffect, useMemo } from 'react';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

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
/**
 * Every plan there has ever been, for filtering a list of history.
 *
 * Deliberately **not** `usePlanOptions`: that one filters to `isActive`,
 * because it feeds the sell form and a retired plan cannot be sold. A payment
 * taken three months ago may well be against a plan since withdrawn, and a
 * filter that omitted it would quietly report the gym earned nothing on it.
 *
 * Pages are pulled until there are none left rather than one oversized request:
 * the faceted filter renders a flat list with no paging of its own, so a plan
 * beyond the first page would simply not be selectable — the same silent drop
 * the combobox rule exists to prevent. A gym has a handful of plans, so in
 * practice this is one request.
 */
export function useAllPlanOptions() {
  const { t } = useTranslation();

  const query = useInfiniteQuery({
    queryKey: ['membership-plans', 'all-options'],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      apiClient.get<PaginatedResponse<MembershipPlan>>('', {
        params: { page: pageParam, limit: OPTIONS_PAGE_SIZE },
      }),
    getNextPageParam: (lastPage) =>
      lastPage.meta.page < lastPage.meta.totalPages
        ? lastPage.meta.page + 1
        : undefined,
  });

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;

  useEffect(() => {
    if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  return useMemo(
    () =>
      (query.data?.pages ?? [])
        .flatMap((page) => page.data)
        // Retired plans are listed and marked, not hidden: they are exactly
        // the ones whose history someone is looking back at.
        .map((plan) => ({
          label: plan.isActive
            ? plan.name
            : `${plan.name} (${t('plans.status.retired')})`,
          value: plan.id,
        })),
    [query.data, t],
  );
}

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

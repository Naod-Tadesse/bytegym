import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { toast } from '@/components/ui/toast';
import ApiClient from '@/services/api-client';
import { toPaginationInfo } from '@/services/pagination';
import type {
  PaginatedPayments,
  Payment,
  PaymentMethod,
  PaymentTableState,
} from '../data/types';

// The hooks file IS the api layer — no separate api/ folder.
const apiClient = new ApiClient('/api/payments');

/**
 * Mirrors `RecordPaymentDto`.
 *
 * There is no `branchId` and no `receivedByStaffId`: both are taken from the
 * access token on the server. Sending them would let a caller record another
 * branch's takings under someone else's name.
 */
export interface RecordPaymentPayload {
  memberId: string;
  /**
   * Required. Every payment settles a membership — a registration fee is part
   * of its membership's `amountDue`, not a payment standing on its own — so
   * this endpoint is only ever reached from a membership row.
   */
  membershipId: string;
  /** A string end to end — never a number, never arithmetic. */
  amount: string;
  method: PaymentMethod;
  reference?: string;
  note?: string;
}

// ===== Queries =====

/**
 * The payments list.
 *
 * Voided payments are deliberately **in** `data` — a shift reconciliation has
 * to show the row that was cancelled and why. They are out of `totals.received`
 * instead, which is the SQL `SUM()` over the whole filter rather than the page:
 * adding the page's rows up in JS would be wrong on two counts, since it is one
 * page of many and the amounts are strings.
 */
export function usePayments(tableState: PaymentTableState) {
  const query = useQuery({
    queryKey: ['payments', 'list', tableState],
    queryFn: () =>
      apiClient.get<PaginatedPayments>('', {
        params: {
          page: tableState.page,
          limit: tableState.limit,
          ...(tableState.from ? { from: tableState.from } : {}),
          ...(tableState.to ? { to: tableState.to } : {}),
          ...(tableState.memberId ? { memberId: tableState.memberId } : {}),
          ...(tableState.membershipId
            ? { membershipId: tableState.membershipId }
            : {}),
        },
      }),
  });

  return {
    payments: query.data?.data ?? [],
    /** `'0'` until the server answers — never summed from `payments`. */
    totalReceived: query.data?.totals?.received ?? '0',
    isLoading: query.isLoading,
    error: query.error,
    paginationInfo: toPaginationInfo(query.data?.meta, tableState),
  };
}

const HISTORY_PAGE_SIZE = 10;

/**
 * One member's payments, newest first, for the member detail page.
 *
 * Paged rather than fetched with one oversized `limit`, exactly as the
 * membership history is: a long-standing member accumulates rows steadily, and
 * a page size that silently truncates would drop the oldest with no empty state
 * to show for it.
 */
export function useMemberPayments(memberId: string) {
  const query = useInfiniteQuery({
    queryKey: ['payments', 'member', memberId],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      apiClient.get<PaginatedPayments>('', {
        params: { memberId, page: pageParam, limit: HISTORY_PAGE_SIZE },
      }),
    getNextPageParam: (lastPage) =>
      lastPage.meta.page < lastPage.meta.totalPages
        ? lastPage.meta.page + 1
        : undefined,
    enabled: !!memberId,
  });

  return {
    payments: (query.data?.pages ?? []).flatMap((page) => page.data),
    total: query.data?.pages[0]?.meta.total ?? 0,
    /** Every non-voided payment this member has made, summed by the server. */
    totalReceived: query.data?.pages[0]?.totals?.received ?? '0',
    isLoading: query.isLoading,
    hasMore: query.hasNextPage,
    showMore: query.fetchNextPage,
    isLoadingMore: query.isFetchingNextPage,
  };
}

// ===== Mutations =====

/**
 * A payment changes what a membership still owes, so `['memberships']` is
 * invalidated alongside `['payments']` — the balance shown beside a membership
 * is derived server-side and would otherwise keep reading the pre-payment
 * figure.
 *
 * `onSuccess` closes the dialog rather than the hook navigating: a payment is
 * taken from the member's own page and leaves you on it.
 */
export function useRecordPayment(onSuccess?: () => void) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: RecordPaymentPayload) =>
      apiClient.post<Payment>('', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['memberships'] });
      toast.add({ title: 'Payment recorded', type: 'success' });
      onSuccess?.();
    },
  });

  return {
    recordPaymentAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
  };
}

/**
 * Voiding is the only way a payment is ever undone — there is no delete. The
 * row stays, carrying its reason, and drops out of `totals.received`.
 *
 * Voiding an already-voided payment is a 409 from the server; the interceptor
 * toasts it and `settle()` keeps the dialog up.
 */
export function useVoidPayment(onSuccess?: () => void) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: ({
      paymentId,
      reason,
    }: {
      paymentId: string;
      reason: string;
    }) => apiClient.patch<Payment>(`/${paymentId}/void`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      // The membership is owed the money again.
      queryClient.invalidateQueries({ queryKey: ['memberships'] });
      toast.add({ title: 'Payment voided', type: 'success' });
      onSuccess?.();
    },
  });

  return {
    voidPaymentAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
  };
}

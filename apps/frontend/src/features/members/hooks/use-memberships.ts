import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';

import { toast } from '@/components/ui/toast';
import ApiClient from '@/services/api-client';
import type { PaymentMethod } from '@/features/payments/data/types';
import type { PaginatedResponse } from '@/services/pagination';
import type { Membership } from '../data/types';

// The hooks file IS the api layer — no separate api/ folder. Memberships are
// only ever reached through a member, so they hang off this feature rather
// than a sixth list screen of their own.
const apiClient = new ApiClient('/api/memberships');

/**
 * Mirrors `SellMembershipDto`.
 *
 * `startsOn` is optional — omitted, the server starts cover today. `endsOn` and
 * `price` are absent on purpose: the server derives the end date from the
 * plan's duration and snapshots the plan's price, so neither is the client's to
 * state.
 */
export interface SellMembershipPayload {
  memberId: string;
  planId: string;
  startsOn?: string;
  isComplimentary?: boolean;
  /**
   * The money handed over at the desk, taken in the same request as the sale.
   *
   * **It carries no amount.** The server computes what is due — the plan's
   * price, plus its registration fee when this is the member's first membership
   * — and records the payment for that full figure. Sending an amount would let
   * the client contradict it.
   *
   * Omit it entirely to sell with nothing paid: that is how an instalment
   * starts, and the record-payment dialog settles the balance afterwards. A
   * complimentary sale carrying one is a 400, and nothing is owed anyway.
   */
  payment?: {
    method: PaymentMethod;
    reference?: string;
    note?: string;
  };
}

// ===== Queries =====

const HISTORY_PAGE_SIZE = 10;

/**
 * One member's membership history, newest first.
 *
 * Paged rather than fetched with one oversized `limit`: a monthly member
 * accumulates a row a month, and a page size that silently truncates would drop
 * the oldest cover with no empty state to show for it. The caller renders a
 * "show more" control off `hasMore`.
 */
export function useMemberships(memberId: string) {
  const query = useInfiniteQuery({
    queryKey: ['memberships', 'list', memberId],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      apiClient.get<PaginatedResponse<Membership>>('', {
        params: { memberId, page: pageParam, limit: HISTORY_PAGE_SIZE },
      }),
    getNextPageParam: (lastPage) =>
      lastPage.meta.page < lastPage.meta.totalPages
        ? lastPage.meta.page + 1
        : undefined,
    enabled: !!memberId,
  });

  return {
    memberships: (query.data?.pages ?? []).flatMap((page) => page.data),
    total: query.data?.pages[0]?.meta.total ?? 0,
    isLoading: query.isLoading,
    hasMore: query.hasNextPage,
    showMore: query.fetchNextPage,
    isLoadingMore: query.isFetchingNextPage,
  };
}

// ===== Mutations =====

/**
 * There is no update and no delete: a mistaken sale is voided along with its
 * payment, never edited, so selling is the only mutation here.
 *
 * A sale can now create the payment in the same request, so it moves three
 * lists at once — see the invalidations below.
 *
 * `onSuccess` is the caller's, not the hook's: selling happens on its own page
 * and lands you back on the member's record, so the destination depends on
 * which member was sold to and only the caller knows that.
 */
export function useSellMembership(onSuccess?: () => void) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    mutationFn: (data: SellMembershipPayload) =>
      apiClient.post<Membership>('', data),
    onSuccess: (_, { memberId }) => {
      queryClient.invalidateQueries({ queryKey: ['memberships'] });
      // `membershipStatus` and `expiresOn` are columns on the member row, so a
      // sale changes the members list and the member detail too — invalidating
      // only ['memberships'] would leave the badge reading `never`.
      queryClient.invalidateQueries({ queryKey: ['members'] });
      queryClient.invalidateQueries({
        queryKey: ['members', 'detail', memberId],
      });
      // The sale takes the payment in the same request, so the payments list
      // and this member's payment history are stale too — without this the
      // money just handed over is missing from the day's total until a refetch.
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      toast.add({ title: 'Membership sold', type: 'success' });
      onSuccess?.();
    },
  });

  return {
    sellMembershipAsync: mutation.mutateAsync,
    isPending: mutation.isPending,
  };
}

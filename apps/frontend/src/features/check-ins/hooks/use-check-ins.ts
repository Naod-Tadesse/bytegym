import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

import { toast } from '@/components/ui/toast';
import ApiClient from '@/services/api-client';
import {
  toPaginationInfo,
  type PaginatedResponse,
} from '@/services/pagination';
import {
  CHECK_IN_REFUSAL_REASONS,
  type CheckIn,
  type CheckInRefusalReason,
  type CheckInTableState,
} from '../data/types';

// The hooks file IS the api layer — no separate api/ folder.
const apiClient = new ApiClient('/api/check-ins');

/**
 * Mirrors `RecordCheckInDto`.
 *
 * No branch and no staff id: the member's branch comes from their record and
 * the person admitting them comes from the access token. Sending either would
 * let a caller file attendance under someone else.
 */
export interface RecordCheckInPayload {
  memberId: string;
  /**
   * Admit them anyway, over an `expired` or `none` refusal.
   *
   * **Only ever sent by the override button, and omitted entirely otherwise.**
   * Holding `checkin.override` is permission to make the decision, not the
   * decision itself: sending this whenever the caller happens to hold the
   * permission would wave every unpaid member straight through, nobody would
   * be prompted to sell a renewal, and `overrideByName` would record who was
   * on shift rather than who chose.
   *
   * It never lifts a `suspended` refusal — the API refuses that with or
   * without the flag, which is why the card does not offer the button there.
   */
  override?: boolean;
}

export interface RecordCheckInResult {
  checkIn: CheckIn;
  /**
   * `true` for a 201 — admitted just now. `false` for a 200 — they were
   * already checked in today and the API replayed the existing row.
   *
   * The bodies are identical, so nothing but the status distinguishes them,
   * and the difference is one the desk needs: the scan registered, and it was
   * not new.
   */
  wasNew: boolean;
}

/**
 * The machine-readable refusal on a 403, or `null` for anything else.
 *
 * Read from `reason`, never from `message`. The prose will be reworded and is
 * already localised in places; the four reasons are a contract.
 */
export function refusalReasonOf(error: unknown): CheckInRefusalReason | null {
  if (!axios.isAxiosError(error) || error.response?.status !== 403) return null;

  const reason = (error.response.data as { reason?: unknown } | undefined)
    ?.reason;

  return CHECK_IN_REFUSAL_REASONS.find((known) => known === reason) ?? null;
}

// ===== Queries =====

/**
 * The check-ins list, newest first.
 *
 * The endpoint takes an inclusive `from`/`to` range, **not** the `on` it once
 * took. Both bounds default to today server-side, but callers are expected to
 * send them anyway: the day belongs in the query key, so a screen left open
 * overnight refetches at midnight instead of serving yesterday's cached rows
 * under today's heading.
 */
export function useCheckIns(tableState: CheckInTableState) {
  const query = useQuery({
    queryKey: ['check-ins', 'list', tableState],
    queryFn: () =>
      apiClient.get<PaginatedResponse<CheckIn>>('', {
        params: {
          page: tableState.page,
          limit: tableState.limit,
          ...(tableState.from ? { from: tableState.from } : {}),
          ...(tableState.to ? { to: tableState.to } : {}),
          ...(tableState.memberId ? { memberId: tableState.memberId } : {}),
          ...(tableState.branchId ? { branchId: tableState.branchId } : {}),
        },
      }),
  });

  return {
    checkIns: query.data?.data ?? [],
    isLoading: query.isLoading,
    error: query.error,
    paginationInfo: toPaginationInfo(query.data?.meta, tableState),
  };
}

// ===== Mutations =====

/**
 * Admit a member.
 *
 * The callbacks report the outcome **per member**, because the desk view shows
 * several search results at once and each card has to say what happened to that
 * member — a toast alone would not say which of them it was about.
 *
 * `onRefused` receives the reason rather than a message: the axios interceptor
 * has already toasted the server's prose, and what the card needs is the next
 * action, which only the reason decides.
 */
export function useRecordCheckIn({
  onRecorded,
  onRefused,
}: {
  onRecorded?: (memberId: string, result: RecordCheckInResult) => void;
  onRefused?: (memberId: string, reason: CheckInRefusalReason | null) => void;
} = {}) {
  const queryClient = useQueryClient();

  const mutation = useMutation({
    // The payload is forwarded whole rather than rebuilt from its parts: a
    // destructured `{ memberId }` here would silently drop `override` and turn
    // the override button back into an ordinary admit that always 403s.
    mutationFn: async (
      payload: RecordCheckInPayload,
    ): Promise<RecordCheckInResult> => {
      // `postRaw`, not `post`: 201 and 200 carry the same body and only the
      // status says whether this was a new admission or a repeat scan.
      const response = await apiClient.postRaw<CheckIn>('', payload);
      return { checkIn: response.data, wasNew: response.status === 201 };
    },
    onSuccess: (result, { memberId }) => {
      queryClient.invalidateQueries({ queryKey: ['check-ins'] });
      // A repeat scan is not an error and not a second success. Saying so
      // plainly is the whole point: the receptionist has to know the scan
      // registered *and* that it did not add anything.
      toast.add(
        result.wasNew
          ? { title: 'Checked in', type: 'success' }
          : { title: 'Already checked in today', type: 'info' },
      );
      onRecorded?.(memberId, result);
    },
    onError: (error, { memberId }) => {
      onRefused?.(memberId, refusalReasonOf(error));
    },
  });

  return {
    recordCheckIn: mutation.mutate,
    /** Which member is in flight, so only that card shows a spinner. */
    pendingMemberId: mutation.isPending
      ? mutation.variables?.memberId
      : undefined,
  };
}

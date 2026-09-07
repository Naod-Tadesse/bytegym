import { useQuery } from '@tanstack/react-query';

import ApiClient from '@/services/api-client';
import {
  toPaginationInfo,
  type PaginatedResponse,
} from '@/services/pagination';
import type { AttendanceRecord, AttendanceTableState } from '../data/types';

// The hooks file IS the api layer — no separate api/ folder.
const apiClient = new ApiClient('/api/check-ins');

// ===== Queries =====

/**
 * The attendance register: every visit over a range, newest first.
 *
 * Deliberately its own hook rather than a call into `useCheckIns`, though both
 * GET `/api/check-ins` today. The desk's hook is tuned to one day at the door —
 * it will grow a poll, or a socket, or a cache that assumes today — and this one
 * is a report read over weeks. Sharing the function would make every change to
 * either screen a change to both; the duplication is four lines of params.
 *
 * The cache key is `['attendance', …]` for the same reason, so a check-in
 * recorded at the desk does not silently invalidate a manager's month-long
 * range. `useRecordCheckIn` invalidates `['check-ins']` only.
 *
 * `from` and `to` are always sent, never left to the server's default: the
 * heading counts `meta.total` over the range, and a range the client cannot name
 * is one it cannot label or key its cache by — a screen left open overnight
 * would keep yesterday's rows under today's date.
 */
export function useAttendance(tableState: AttendanceTableState) {
  const query = useQuery({
    queryKey: ['attendance', 'list', tableState],
    queryFn: () =>
      apiClient.get<PaginatedResponse<AttendanceRecord>>('', {
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
    records: query.data?.data ?? [],
    /**
     * Visits matching the filter across **all** pages, from `meta.total`.
     *
     * Never `records.length`, which is one page of ten and would report "10
     * visits" for a month that had four hundred.
     */
    total: query.data?.meta.total ?? 0,
    isLoading: query.isLoading,
    error: query.error,
    paginationInfo: toPaginationInfo(query.data?.meta, tableState),
  };
}

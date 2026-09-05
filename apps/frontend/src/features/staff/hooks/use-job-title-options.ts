import { useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';

import ApiClient from '@/services/api-client';
import type { PaginatedResponse } from '@/services/pagination';

/**
 * Read-only. There is no job-titles admin screen and no create/update endpoint:
 * the catalogue is seeded from code on the backend, because application logic
 * branches on it. `code` is the stable identifier — never branch on `name`,
 * which is only a label.
 */
interface JobTitle {
  id: string;
  code: string;
  name: string;
  canHaveAccount: boolean;
  isActive: boolean;
}

const apiClient = new ApiClient('/api/job-titles');

const OPTIONS_PAGE_SIZE = 20;

/**
 * Feeds a `DataCombobox`. Job titles are a paginated endpoint, so this pages
 * and searches server-side rather than pulling one oversized page and hoping
 * it covers everything.
 *
 * `search` should already be debounced by the caller.
 */
export function useJobTitleOptions(search?: string) {
  const query = useInfiniteQuery({
    queryKey: ['job-titles', 'options', search ?? ''],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      apiClient.get<PaginatedResponse<JobTitle>>('', {
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

  const jobTitles = useMemo(
    () =>
      (query.data?.pages ?? [])
        .flatMap((page) => page.data)
        // Retired titles stay on existing staff but are assignable to nobody new.
        .filter((jobTitle) => jobTitle.isActive),
    [query.data],
  );

  return {
    options: useMemo(
      () =>
        jobTitles.map((jobTitle) => ({
          label: jobTitle.name,
          value: jobTitle.id,
        })),
      [jobTitles],
    ),
    /**
     * `DataComboboxOption` is only `{value,label}`, so the flag the form needs
     * to decide whether to ask for a password cannot ride inside `options` —
     * it comes back beside them, keyed by id.
     *
     * Only titles on a loaded page are in here. Read it at the moment of
     * choosing and copy the answer into form state; do not re-read it on every
     * render, or a search that pages the chosen row away would flip it.
     */
    canHaveAccountById: useMemo(
      () =>
        new Map(
          jobTitles.map((jobTitle) => [jobTitle.id, jobTitle.canHaveAccount]),
        ),
      [jobTitles],
    ),
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage,
    isLoading: query.isLoading || query.isFetchingNextPage,
  };
}

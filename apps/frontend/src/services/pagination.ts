/** The envelope every paginated backend list returns. */
export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: PaginationMeta;
}

/** What `DataTable` needs to drive its footer. */
export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

/** Every list screen holds at least this much table state. */
export interface TableState {
  page: number;
  limit: number;
  search?: string;
}

/**
 * Falls back to the requested page/limit so the footer stays stable during the
 * first load, when `meta` has not arrived yet.
 */
export function toPaginationInfo(
  meta: PaginationMeta | undefined,
  requested: { page: number; limit: number },
): PaginationInfo {
  const page = meta?.page ?? requested.page;
  const totalPages = meta?.totalPages ?? 1;

  return {
    page,
    limit: meta?.limit ?? requested.limit,
    total: meta?.total ?? 0,
    totalPages,
    hasNext: page < totalPages,
    hasPrev: page > 1,
  };
}

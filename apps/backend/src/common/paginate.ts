import type { PaginatedResponse } from './pagination.dto';

/**
 * ekos copy-pastes this block into every service; this is the extraction.
 *
 * Callers build their own Drizzle queries (they know their joins and columns)
 * and hand back the rows plus the total, so the offset maths and the `meta`
 * envelope live in exactly one place.
 */
export function toOffset(page = 1, limit = 10) {
  return { page, limit, offset: (page - 1) * limit };
}

export function paginated<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResponse<T> {
  return {
    data,
    meta: {
      total,
      page,
      limit,
      // Never report 0 pages — an empty list is still page 1 of 1.
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

/** Postgres returns count(*) as a string; this is where that gets forgotten. */
export function countOf(rows: { count: number | string }[]): number {
  return Number(rows[0]?.count ?? 0);
}

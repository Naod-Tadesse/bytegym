import { countOf, paginated, toOffset } from './paginate';

/**
 * The pagination envelope is a contract, not an implementation detail: the
 * frontend `DataTable` reads `meta` and nothing else, so the shape of what
 * comes out of here is what every list endpoint promises.
 */
describe('toOffset', () => {
  it('starts page 1 at offset 0', () => {
    expect(toOffset(1, 10)).toEqual({ page: 1, limit: 10, offset: 0 });
  });

  it('advances by a whole page at a time', () => {
    expect(toOffset(2, 10).offset).toBe(10);
    expect(toOffset(3, 25).offset).toBe(50);
  });

  it('defaults to the first page of ten', () => {
    // The defaults have to match PaginationDto, or an endpoint that forgets to
    // pass a page silently returns a different slice than the DTO documents.
    expect(toOffset()).toEqual({ page: 1, limit: 10, offset: 0 });
  });
});

describe('paginated', () => {
  const rows = [{ id: 'a' }, { id: 'b' }];

  it('returns the rows untouched alongside the meta block', () => {
    const result = paginated(rows, 2, 1, 10);
    expect(result.data).toBe(rows);
    expect(result.meta).toEqual({ total: 2, page: 1, limit: 10, totalPages: 1 });
  });

  it('rounds a partial last page up', () => {
    expect(paginated(rows, 21, 1, 10).meta.totalPages).toBe(3);
  });

  it('reports exactly one page when the total divides evenly', () => {
    expect(paginated(rows, 20, 1, 10).meta.totalPages).toBe(2);
  });

  it('never reports zero pages for an empty result', () => {
    // Otherwise the UI renders "page 1 of 0", which reads as a fault rather
    // than as "nothing matched".
    expect(paginated([], 0, 1, 10).meta.totalPages).toBe(1);
  });

  it('echoes the page it was given, even past the end', () => {
    // Asking for page 9 of 1 is not an error; it is an empty page, and the
    // client needs its own number back to keep its controls consistent.
    expect(paginated([], 0, 9, 10).meta.page).toBe(9);
  });
});

describe('countOf', () => {
  it('converts the string Postgres returns for count(*)', () => {
    expect(countOf([{ count: '42' }])).toBe(42);
  });

  it('accepts a number, for drivers that already coerce', () => {
    expect(countOf([{ count: 42 }])).toBe(42);
  });

  it('reads no rows as zero rather than NaN', () => {
    // An aggregate with a GROUP BY that matched nothing comes back empty.
    expect(countOf([])).toBe(0);
  });
});

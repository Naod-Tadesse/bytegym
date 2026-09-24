import {
  isExclusionViolation,
  isForeignKeyViolation,
  isUniqueViolation,
  pgErrorCode,
} from './pg-errors';

/**
 * Drizzle v1 wraps the driver's error in a `DrizzleQueryError` and puts the
 * original on `cause`, so `error.code` is undefined and a check written
 * against it never matches. Everything here is about walking that chain — get
 * it wrong and a legitimate 409 surfaces as a 500.
 */
const wrap = (cause: unknown) =>
  Object.assign(new Error('Failed query: insert into …'), { cause });

describe('pgErrorCode', () => {
  it('reads the code off the error itself', () => {
    expect(pgErrorCode({ code: '23505' })).toBe('23505');
  });

  it('finds it one cause deep, as Drizzle leaves it', () => {
    expect(pgErrorCode(wrap({ code: '23505' }))).toBe('23505');
  });

  it('finds it several causes deep', () => {
    expect(pgErrorCode(wrap(wrap({ code: '23P01' })))).toBe('23P01');
  });

  it('gives up rather than looping forever on a cyclic chain', () => {
    // A self-referencing cause would hang an unbounded walk.
    const cyclic: { cause?: unknown } = {};
    cyclic.cause = cyclic;
    expect(pgErrorCode(cyclic)).toBeUndefined();
  });

  it('stops after a handful of links', () => {
    // Five deep is past the documented slack, so this must not resolve.
    const deep = wrap(wrap(wrap(wrap(wrap(wrap({ code: '23505' }))))));
    expect(pgErrorCode(deep)).toBeUndefined();
  });

  it.each<[unknown, string]>([
    [null, 'null'],
    [undefined, 'undefined'],
    ['a string', 'a thrown string'],
    [new Error('plain'), 'an error with no code and no cause'],
    [{ code: 23505 }, 'a numeric code, which pg never sends'],
  ])('returns undefined for %s (%s)', (input) => {
    expect(pgErrorCode(input)).toBeUndefined();
  });
});

describe('the three violations we translate', () => {
  it('recognises 23505 as a unique violation', () => {
    // The index is the real guard: two concurrent requests both pass the
    // friendly pre-check under READ COMMITTED, and the second insert loses.
    expect(isUniqueViolation(wrap({ code: '23505' }))).toBe(true);
    expect(isUniqueViolation(wrap({ code: '23P01' }))).toBe(false);
  });

  it('recognises 23P01 as an exclusion violation', () => {
    // memberships_no_overlap. "Those days are already sold to this member",
    // which is a different sentence to "that name is taken".
    expect(isExclusionViolation(wrap({ code: '23P01' }))).toBe(true);
    expect(isExclusionViolation(wrap({ code: '23505' }))).toBe(false);
  });

  it('recognises 23503 as a foreign key violation', () => {
    // A well-formed uuid that names nothing gets past ParseUUIDPipe, so the
    // insert is the first thing to object. Untranslated, that is a 500.
    expect(isForeignKeyViolation(wrap({ code: '23503' }))).toBe(true);
    expect(isForeignKeyViolation(wrap({ code: '23505' }))).toBe(false);
  });

  it('treats the three as mutually exclusive', () => {
    const unique = wrap({ code: '23505' });
    expect(
      [
        isUniqueViolation(unique),
        isExclusionViolation(unique),
        isForeignKeyViolation(unique),
      ].filter(Boolean),
    ).toHaveLength(1);
  });

  it('says no to an unrelated database error', () => {
    // 23502 is a not-null violation — a bug, not something to translate into
    // a friendly status.
    const notNull = wrap({ code: '23502' });
    expect(isUniqueViolation(notNull)).toBe(false);
    expect(isExclusionViolation(notNull)).toBe(false);
    expect(isForeignKeyViolation(notNull)).toBe(false);
  });

  it('says no to something that is not a database error at all', () => {
    expect(isUniqueViolation(new TypeError('undefined is not a function'))).toBe(
      false,
    );
  });
});

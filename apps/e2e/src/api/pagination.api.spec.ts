import { test, expect } from '../support/fixtures';
import type { Paginated } from '../support/api-client';
import { RUN_ID } from '../support/env';

/**
 * Every list endpoint takes PaginationDto and returns exactly
 * { data, meta: { total, page, limit, totalPages } } — the frontend DataTable
 * reads meta, so the shape is a contract rather than an implementation detail.
 */
const LIST_ENDPOINTS = [
  '/members',
  '/staff',
  '/branches',
  '/membership-plans',
  '/memberships',
  '/payments',
  '/check-ins',
  '/roles',
  '/sms',
  '/job-titles',
];

test.describe('the pagination envelope', () => {
  for (const path of LIST_ENDPOINTS) {
    test(`${path} returns data and a complete meta block`, async ({ api }) => {
      const page = await api.json<Paginated<unknown>>(api.get(path, { limit: 1 }));
      expect(Array.isArray(page.data)).toBe(true);
      expect(page.meta).toMatchObject({
        total: expect.any(Number),
        page: expect.any(Number),
        limit: expect.any(Number),
        totalPages: expect.any(Number),
      });
    });
  }

  test('/permissions is the one list that is NOT paginated', async ({ api }) => {
    // The catalogue is code, fixed and small — it returns a plain array.
    const body = await api.json<unknown>(api.get('/permissions'));
    expect(Array.isArray(body)).toBe(true);
  });
});

test.describe('bounds', () => {
  test('rejects a limit above 100', async ({ api }) => {
    expect((await api.get('/members', { limit: 101 })).status()).toBe(400);
  });

  test('accepts a limit of exactly 100', async ({ api }) => {
    expect((await api.get('/members', { limit: 100 })).status()).toBe(200);
  });

  test('rejects a limit of 0 and a negative limit', async ({ api }) => {
    expect((await api.get('/members', { limit: 0 })).status()).toBe(400);
    expect((await api.get('/members', { limit: -1 })).status()).toBe(400);
  });

  test('rejects a page below 1', async ({ api }) => {
    expect((await api.get('/members', { page: 0 })).status()).toBe(400);
    expect((await api.get('/members', { page: -3 })).status()).toBe(400);
  });

  test('rejects a non-numeric page or limit', async ({ api }) => {
    expect((await api.get('/members', { page: 'two' })).status()).toBe(400);
    expect((await api.get('/members', { limit: 'lots' })).status()).toBe(400);
  });

  test('defaults to page 1 and limit 10', async ({ api }) => {
    const page = await api.json<Paginated<unknown>>(api.get('/members'));
    expect(page.meta.page).toBe(1);
    expect(page.meta.limit).toBe(10);
    expect(page.data.length).toBeLessThanOrEqual(10);
  });
});

test.describe('paging behaviour', () => {
  test('page 2 returns different rows from page 1', async ({ api, data }) => {
    // Needs at least three members to be meaningful; the dev database has more
    // than that on its own, and these add to it.
    await Promise.all([data.member(), data.member(), data.member()]);

    const first = await api.json<Paginated<{ personId: string }>>(
      api.get('/members', { limit: 2, page: 1 }),
    );
    const second = await api.json<Paginated<{ personId: string }>>(
      api.get('/members', { limit: 2, page: 2 }),
    );

    expect(first.meta.page).toBe(1);
    expect(second.meta.page).toBe(2);
    const overlap = first.data
      .map((m) => m.personId)
      .filter((id) => second.data.some((m) => m.personId === id));
    expect(overlap).toEqual([]);
  });

  test('totalPages agrees with total and limit', async ({ api }) => {
    const page = await api.json<Paginated<unknown>>(api.get('/members', { limit: 5 }));
    expect(page.meta.totalPages).toBe(
      Math.max(1, Math.ceil(page.meta.total / page.meta.limit)),
    );
  });

  test('a page past the end returns no rows but keeps a coherent meta', async ({ api }) => {
    const first = await api.json<Paginated<unknown>>(api.get('/members', { limit: 5 }));
    const beyond = await api.json<Paginated<unknown>>(
      api.get('/members', { limit: 5, page: first.meta.totalPages + 50 }),
    );
    expect(beyond.data).toEqual([]);
    expect(beyond.meta.limit).toBe(5);
    expect(beyond.meta.totalPages).toBe(Math.max(1, beyond.meta.totalPages));
  });

  test('totalPages is 1 for an empty result set, never 0', async ({ api }) => {
    // max(1, ceil(total/limit)) — otherwise the UI renders "page 1 of 0".
    for (const path of ['/members', '/staff', '/branches', '/membership-plans']) {
      const page = await api.json<Paginated<unknown>>(
        api.get(path, { search: `nothing-matches-${RUN_ID()}` }),
      );
      expect(page.data, path).toEqual([]);
      expect(page.meta.total, path).toBe(0);
      expect(page.meta.totalPages, path).toBe(1);
    }
  });

  test('the limit caps the rows returned', async ({ api, data }) => {
    await Promise.all([data.member(), data.member(), data.member()]);
    const page = await api.json<Paginated<unknown>>(api.get('/members', { limit: 2 }));
    expect(page.data.length).toBe(2);
  });
});

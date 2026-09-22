import { test, expect } from '../support/fixtures';
import type { Paginated } from '../support/api-client';
import { record } from '../support/manifest';
import { uniqueName } from '../support/unique';

interface Branch {
  id: string;
  name: string;
  city: string | null;
  phone: string | null;
  addressLine: string | null;
  isActive: boolean;
}

test.describe('branches', () => {
  test('creates a branch and returns it in the list', async ({ api, scope }) => {
    const name = uniqueName(scope, 'branch');
    const created = await api.json<Branch>(
      api.post('/branches', { name, city: 'Hawassa', phone: '0116000000' }),
    );
    record('branches', created.id);
    expect(created).toMatchObject({ name, city: 'Hawassa', isActive: true });

    const page = await api.json<Paginated<Branch>>(
      api.get('/branches', { search: name }),
    );
    expect(page.data.map((b) => b.name)).toContain(name);
  });

  test('rejects a duplicate name differing only in case', async ({ api, data }) => {
    // The index is on lower(name), and the pre-check uses lower(x) = lower(?)
    // rather than ilike — otherwise `branch_a` would collide with `branchXa`.
    const existing = await data.branch();
    const res = await api.post('/branches', { name: existing.name.toUpperCase() });
    expect(res.status()).toBe(409);
    expect((await res.json()).message).toBe('A branch with this name already exists');
  });

  test('rejects an empty name', async ({ api }) => {
    expect((await api.post('/branches', { name: '' })).status()).toBe(400);
  });

  test('rejects a name longer than 120 characters', async ({ api }) => {
    expect((await api.post('/branches', { name: 'x'.repeat(121) })).status()).toBe(400);
  });

  test('accepts a name of exactly 120 characters', async ({ api, scope }) => {
    const name = `${uniqueName(scope, 'b')}`.padEnd(120, 'x').slice(0, 120);
    const res = await api.post('/branches', { name });
    expect(res.status()).toBe(201);
    record('branches', (await res.json()).id);
  });

  test('accepts a free-form branch phone, unlike a staff phone', async ({ api, scope }) => {
    // Branch phone is deliberately looser: a landline or switchboard is fine.
    const res = await api.post('/branches', {
      name: uniqueName(scope, 'branch'),
      phone: '011-663-1212 ext 4',
    });
    expect(res.status()).toBe(201);
    record('branches', (await res.json()).id);
  });

  test('updates city, phone and address', async ({ api, data }) => {
    const b = await data.branch();
    const updated = await api.json<Branch>(
      api.patch(`/branches/${b.id}`, {
        city: 'Bahir Dar',
        phone: '0582200000',
        addressLine: 'Beside the stadium',
      }),
    );
    expect(updated).toMatchObject({
      city: 'Bahir Dar',
      phone: '0582200000',
      addressLine: 'Beside the stadium',
    });
  });

  test('rejects renaming onto another branch name', async ({ api, data }) => {
    const [a, b] = [await data.branch(), await data.branch()];
    const res = await api.patch(`/branches/${b.id}`, { name: a.name });
    expect(res.status()).toBe(409);
  });

  test('DELETE deactivates rather than deletes, and the row stays listed', async ({
    api,
    data,
  }) => {
    // There is no branch.delete permission and no hard delete: a branch that
    // ever took a payment must stay resolvable forever.
    const b = await data.branch();
    const res = await api.delete(`/branches/${b.id}`);
    expect(res.status()).toBe(200);
    expect(await res.json()).toMatchObject({ id: b.id, isActive: false });

    const page = await api.json<Paginated<Branch>>(
      api.get('/branches', { search: b.name }),
    );
    expect(page.data.find((x) => x.id === b.id)).toMatchObject({ isActive: false });
  });

  test('a deactivated branch can be reactivated', async ({ api, data }) => {
    const b = await data.branch({ isActive: false });
    const updated = await api.json<Branch>(
      api.patch(`/branches/${b.id}`, { isActive: true }),
    );
    expect(updated.isActive).toBe(true);
  });

  test('reads one branch by id', async ({ api, data }) => {
    const b = await data.branch();
    const got = await api.json<Branch>(api.get(`/branches/${b.id}`));
    expect(got.id).toBe(b.id);
  });

  test('rejects a non-uuid id with 400 from ParseUUIDPipe', async ({ api }) => {
    expect((await api.get('/branches/not-a-uuid')).status()).toBe(400);
  });

  test('returns 404 for an unknown uuid', async ({ api }) => {
    const res = await api.get('/branches/00000000-0000-4000-8000-000000000000');
    expect(res.status()).toBe(404);
    expect((await res.json()).message).toBe('Branch not found');
  });

  test('search matches case-insensitively', async ({ api, data }) => {
    const b = await data.branch();
    const page = await api.json<Paginated<Branch>>(
      api.get('/branches', { search: b.name.toLowerCase() }),
    );
    expect(page.data.map((x) => x.id)).toContain(b.id);
  });

  test('inactive branches are still listed', async ({ api, data }) => {
    const b = await data.branch({ isActive: false });
    const page = await api.json<Paginated<Branch>>(
      api.get('/branches', { search: b.name }),
    );
    expect(page.data.map((x) => x.id)).toContain(b.id);
  });
});

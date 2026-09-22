import { test, expect } from '../support/fixtures';
import type { Paginated } from '../support/api-client';
import { record } from '../support/manifest';
import { uniqueName } from '../support/unique';

interface Plan {
  id: string;
  name: string;
  durationDays: number;
  price: string;
  registrationFee: string;
  isActive: boolean;
  description: string | null;
}

test.describe('membership plans', () => {
  test('creates a plan with a registration fee', async ({ api, scope }) => {
    const name = uniqueName(scope, 'plan');
    const plan = await api.json<Plan>(
      api.post('/membership-plans', {
        name,
        durationDays: 30,
        price: '1500',
        registrationFee: '900',
        description: 'One month, unlimited visits.',
      }),
    );
    record('membership_plans', plan.id);
    expect(plan).toMatchObject({ name, durationDays: 30, isActive: true });
  });

  test('returns money as two-decimal strings, not numbers', async ({ api, data }) => {
    // numeric(12,2) round-trips as a string so nothing is lost to float.
    const plan = await data.plan({ price: '1500', registrationFee: '900' });
    const got = await api.json<Plan>(api.get(`/membership-plans/${plan.id}`));
    expect(got.price).toBe('1500.00');
    expect(got.registrationFee).toBe('900.00');
  });

  test('defaults the registration fee to zero', async ({ api, scope }) => {
    const res = await api.post('/membership-plans', {
      name: uniqueName(scope, 'plan'),
      durationDays: 30,
      price: '1000',
    });
    expect(res.status()).toBe(201);
    const plan = (await res.json()) as Plan;
    record('membership_plans', plan.id);
    expect(plan.registrationFee).toBe('0.00');
  });

  test('rejects a duplicate name differing only in case', async ({ api, data }) => {
    const existing = await data.plan();
    const res = await api.post('/membership-plans', {
      name: existing.name.toUpperCase(),
      durationDays: 30,
      price: '1000',
    });
    expect(res.status()).toBe(409);
    expect((await res.json()).message).toBe('A plan with this name already exists');
  });

  test('rejects a duration of zero', async ({ api, scope }) => {
    const res = await api.post('/membership-plans', {
      name: uniqueName(scope, 'plan'),
      durationDays: 0,
      price: '1000',
    });
    expect(res.status()).toBe(400);
  });

  test('rejects a negative duration', async ({ api, scope }) => {
    const res = await api.post('/membership-plans', {
      name: uniqueName(scope, 'plan'),
      durationDays: -5,
      price: '1000',
    });
    expect(res.status()).toBe(400);
  });

  test('rejects a price with three decimal places', async ({ api, scope }) => {
    const res = await api.post('/membership-plans', {
      name: uniqueName(scope, 'plan'),
      durationDays: 30,
      price: '1000.123',
    });
    expect(res.status()).toBe(400);
    expect(String((await res.json()).message)).toContain('price must be a number');
  });

  test('rejects a non-numeric price', async ({ api, scope }) => {
    const res = await api.post('/membership-plans', {
      name: uniqueName(scope, 'plan'),
      durationDays: 30,
      price: 'free',
    });
    expect(res.status()).toBe(400);
  });

  test('retires a plan, which stays in the list', async ({ api, data }) => {
    const plan = await data.plan();
    const updated = await api.json<Plan>(
      api.patch(`/membership-plans/${plan.id}`, { isActive: false }),
    );
    expect(updated.isActive).toBe(false);

    const page = await api.json<Paginated<Plan>>(
      api.get('/membership-plans', { search: plan.name }),
    );
    expect(page.data.map((p) => p.id)).toContain(plan.id);
  });

  test('a retired plan can be put back on sale', async ({ api, data }) => {
    const plan = await data.plan({ isActive: false });
    const updated = await api.json<Plan>(
      api.patch(`/membership-plans/${plan.id}`, { isActive: true }),
    );
    expect(updated.isActive).toBe(true);
  });

  test('isActive=true filters out retired plans', async ({ api, data }) => {
    const live = await data.plan();
    const retired = await data.plan({ isActive: false });
    // Scoped by name rather than paging every plan: other workers add plans
    // while this runs.
    const onSale = await api.json<Paginated<Plan>>(
      api.get('/membership-plans', { isActive: true, search: live.name }),
    );
    expect(onSale.data.map((p) => p.id)).toContain(live.id);

    const hidden = await api.json<Paginated<Plan>>(
      api.get('/membership-plans', { isActive: true, search: retired.name }),
    );
    expect(hidden.data.map((p) => p.id)).not.toContain(retired.id);
  });

  test('isActive=false is honoured, not coerced to true', async ({ api, data }) => {
    // Boolean('false') === true, so the DTO reads the raw query string. Without
    // that transform this filter would silently mean the opposite.
    const retired = await data.plan({ isActive: false });
    const page = await api.json<Paginated<Plan>>(
      api.get('/membership-plans', { isActive: false, search: retired.name }),
    );
    expect(page.data.every((p) => !p.isActive)).toBe(true);
    expect(page.data.map((p) => p.id)).toContain(retired.id);
  });

  test('there is no delete route for a plan', async ({ api, data }) => {
    // A plan that was ever sold has to stay resolvable, so retiring is the only
    // way out and there is no plan.delete permission.
    const plan = await data.plan();
    expect([404, 405]).toContain((await api.delete(`/membership-plans/${plan.id}`)).status());
  });

  test('returns 404 for an unknown plan', async ({ api }) => {
    const res = await api.get('/membership-plans/00000000-0000-4000-8000-000000000000');
    expect(res.status()).toBe(404);
    expect((await res.json()).message).toBe('Membership plan not found');
  });
});

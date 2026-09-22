import { test, expect } from '../support/fixtures';
import { record } from '../support/manifest';

interface Dashboard {
  members: {
    total: number;
    active: number;
    expired: number;
    never: number;
    inactive: number;
    suspended: number;
  };
  checkInsToday: number;
  paymentsToday: { count: number; received: string };
}

/**
 * The suite shares a database with real dev data, so nothing here asserts an
 * absolute figure. Every case reads the dashboard, does one thing, reads it
 * again and asserts the delta — which is a better test of the query anyway.
 */
test.describe.configure({ mode: 'serial' });

test.describe('dashboard', () => {
  test('requires report.view', async ({ as }) => {
    const reception = await as('reception');
    const res = await reception.get('/reports/dashboard');
    expect(res.status()).toBe(403);
    expect((await res.json()).message).toBe('Missing permission: report.view');
  });

  test('returns every tally the dashboard renders', async ({ api }) => {
    const d = await api.json<Dashboard>(api.get('/reports/dashboard'));
    expect(d.members).toMatchObject({
      total: expect.any(Number),
      active: expect.any(Number),
      expired: expect.any(Number),
      never: expect.any(Number),
      suspended: expect.any(Number),
    });
    expect(d.checkInsToday).toEqual(expect.any(Number));
    expect(d.paymentsToday.received).toMatch(/^-?\d+\.\d{2}$/);
  });

  test('a new member raises the total by exactly one', async ({ api, data }) => {
    const before = await api.json<Dashboard>(api.get('/reports/dashboard'));
    await data.member();
    const after = await api.json<Dashboard>(api.get('/reports/dashboard'));
    expect(after.members.total).toBe(before.members.total + 1);
  });

  test('a fresh member counts as never, not expired', async ({ api, data }) => {
    const before = await api.json<Dashboard>(api.get('/reports/dashboard'));
    await data.member();
    const after = await api.json<Dashboard>(api.get('/reports/dashboard'));
    expect(after.members.never).toBe(before.members.never + 1);
    expect(after.members.expired).toBe(before.members.expired);
  });

  test('selling a membership moves them from never to active', async ({ api, data }) => {
    const member = await data.member();
    const before = await api.json<Dashboard>(api.get('/reports/dashboard'));

    const plan = await data.plan({ durationDays: 30 });
    await data.membership({ memberId: member.id, planId: plan.id });

    const after = await api.json<Dashboard>(api.get('/reports/dashboard'));
    expect(after.members.active).toBe(before.members.active + 1);
    expect(after.members.never).toBe(before.members.never - 1);
  });

  test('an expired membership counts as expired', async ({ api, data }) => {
    const before = await api.json<Dashboard>(api.get('/reports/dashboard'));
    await data.expiredMember();
    const after = await api.json<Dashboard>(api.get('/reports/dashboard'));
    expect(after.members.expired).toBe(before.members.expired + 1);
  });

  test('a check-in raises checkInsToday by one', async ({ api, data }) => {
    const { member } = await data.activeMember();
    const before = await api.json<Dashboard>(api.get('/reports/dashboard'));

    const res = await api.post('/check-ins', { memberId: member.id });
    record('check_ins', String((await res.json()).id));

    const after = await api.json<Dashboard>(api.get('/reports/dashboard'));
    expect(after.checkInsToday).toBe(before.checkInsToday + 1);
  });

  test('a second scan by the same member does not count twice', async ({ api, data }) => {
    // One check-in per member per gym day, so the tally cannot double.
    const { member } = await data.activeMember();
    const first = await api.post('/check-ins', { memberId: member.id });
    record('check_ins', String((await first.json()).id));

    const before = await api.json<Dashboard>(api.get('/reports/dashboard'));
    await api.post('/check-ins', { memberId: member.id });
    const after = await api.json<Dashboard>(api.get('/reports/dashboard'));

    expect(after.checkInsToday).toBe(before.checkInsToday);
  });

  test('a payment raises todays takings, and voiding it lowers them again', async ({
    api,
    data,
  }) => {
    const member = await data.member();
    const plan = await data.plan({ price: '1000', registrationFee: '0' });
    const membership = await data.membership({ memberId: member.id, planId: plan.id });

    const before = await api.json<Dashboard>(api.get('/reports/dashboard'));

    const payment = await data.payment({
      memberId: member.id,
      membershipId: membership.id,
      amount: '250',
    });
    const paid = await api.json<Dashboard>(api.get('/reports/dashboard'));
    expect(paid.paymentsToday.count).toBe(before.paymentsToday.count + 1);
    expect(Number(paid.paymentsToday.received)).toBeCloseTo(
      Number(before.paymentsToday.received) + 250,
      2,
    );

    await api.patch(`/payments/${payment.id}/void`, { reason: 'E2E void' });

    const voided = await api.json<Dashboard>(api.get('/reports/dashboard'));
    expect(Number(voided.paymentsToday.received)).toBeCloseTo(
      Number(before.paymentsToday.received),
      2,
    );
  });

  test('a suspended member is still counted as active while their cover runs', async ({
    api,
    data,
  }) => {
    // Suspension and membership state are independent: being barred from the
    // premises does not expire what they paid for.
    const { member } = await data.activeMember();
    const before = await api.json<Dashboard>(api.get('/reports/dashboard'));

    await api.patch(`/members/${member.id}/suspension`, { isSuspended: true });

    const after = await api.json<Dashboard>(api.get('/reports/dashboard'));
    expect(after.members.suspended).toBe(before.members.suspended + 1);
    expect(after.members.active).toBe(before.members.active);
  });

  test('a deleted member leaves the totals', async ({ api, data }) => {
    const member = await data.member();
    const before = await api.json<Dashboard>(api.get('/reports/dashboard'));
    await api.delete(`/members/${member.id}`);
    const after = await api.json<Dashboard>(api.get('/reports/dashboard'));
    expect(after.members.total).toBe(before.members.total - 1);
  });
});

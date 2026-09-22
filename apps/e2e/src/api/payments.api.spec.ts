import { test, expect } from '../support/fixtures';
import type { Paginated } from '../support/api-client';
import type { Factories, Membership } from '../support/factories';
import { gymToday } from '../support/env';

interface Payment {
  id: string;
  memberId: string;
  memberName: string;
  membershipId: string;
  branchId: string;
  amount: string;
  method: string;
  reference: string | null;
  note: string | null;
  receivedByName: string | null;
  receivedAt: string;
  voidedAt: string | null;
  voidReason: string | null;
  voidedByName: string | null;
}

type PaymentPage = Paginated<Payment> & { totals: { received: string } };

/** A member with a 1000-birr membership and nothing paid yet. */
async function owing(data: Factories) {
  const member = await data.member();
  const plan = await data.plan({ price: '1000', registrationFee: '0' });
  const membership = await data.membership({ memberId: member.id, planId: plan.id });
  return { member, plan, membership };
}

test.describe('recording a payment', () => {
  test('a part payment reduces the balance by that amount', async ({ api, data }) => {
    const { member, membership } = await owing(data);
    await data.payment({
      memberId: member.id,
      membershipId: membership.id,
      amount: '400',
    });

    const after = await api.json<Membership>(api.get(`/memberships/${membership.id}`));
    expect(after.paidTotal).toBe('400.00');
    expect(after.balance).toBe('600.00');
  });

  test('a second part payment clears it', async ({ api, data }) => {
    const { member, membership } = await owing(data);
    await data.payment({ memberId: member.id, membershipId: membership.id, amount: '400' });
    await data.payment({ memberId: member.id, membershipId: membership.id, amount: '600' });

    const after = await api.json<Membership>(api.get(`/memberships/${membership.id}`));
    expect(after.paidTotal).toBe('1000.00');
    expect(after.balance).toBe('0.00');
  });

  test('overpaying drives the balance negative rather than capping at zero', async ({
    api,
    data,
  }) => {
    // Nothing caps a payment at the outstanding amount, and hiding the excess
    // behind a zero would lose money the gym actually owes back.
    const { member, membership } = await owing(data);
    await data.payment({ memberId: member.id, membershipId: membership.id, amount: '1500' });

    const after = await api.json<Membership>(api.get(`/memberships/${membership.id}`));
    expect(after.balance).toBe('-500.00');
  });

  test('records the method and reference', async ({ api, data }) => {
    const { member, membership } = await owing(data);
    const p = await data.payment({
      memberId: member.id,
      membershipId: membership.id,
      amount: '100',
      method: 'telebirr',
      reference: 'TB-9912',
    });
    const page = await api.json<PaymentPage>(
      api.get('/payments', { membershipId: membership.id }),
    );
    expect(page.data.find((x) => x.id === p.id)).toMatchObject({
      method: 'telebirr',
      reference: 'TB-9912',
    });
  });

  test('accepts every payment method in the enum', async ({ api, data }) => {
    for (const method of ['cash', 'telebirr', 'cbe_birr', 'bank_transfer', 'card']) {
      const { member, membership } = await owing(data);
      const res = await api.post('/payments', {
        memberId: member.id,
        membershipId: membership.id,
        amount: '10',
        method,
      });
      expect(res.status(), `method ${method}`).toBe(201);
    }
  });

  test('rejects an unknown method', async ({ api, data }) => {
    const { member, membership } = await owing(data);
    const res = await api.post('/payments', {
      memberId: member.id,
      membershipId: membership.id,
      amount: '100',
      method: 'bitcoin',
    });
    expect(res.status()).toBe(400);
  });

  test('rejects an amount of zero', async ({ api, data }) => {
    // AMOUNT_PATTERN has a negative lookahead for zero: a payment of nothing is
    // not a payment.
    const { member, membership } = await owing(data);
    for (const amount of ['0', '0.00', '00']) {
      const res = await api.post('/payments', {
        memberId: member.id,
        membershipId: membership.id,
        amount,
        method: 'cash',
      });
      expect(res.status(), `amount ${amount}`).toBe(400);
    }
  });

  test('rejects a negative amount', async ({ api, data }) => {
    const { member, membership } = await owing(data);
    const res = await api.post('/payments', {
      memberId: member.id,
      membershipId: membership.id,
      amount: '-100',
      method: 'cash',
    });
    expect(res.status()).toBe(400);
  });

  test('rejects more than two decimal places', async ({ api, data }) => {
    const { member, membership } = await owing(data);
    const res = await api.post('/payments', {
      memberId: member.id,
      membershipId: membership.id,
      amount: '100.123',
      method: 'cash',
    });
    expect(res.status()).toBe(400);
    expect(String((await res.json()).message)).toContain('at most 2 decimals');
  });

  test('accepts exactly two decimal places', async ({ api, data }) => {
    const { member, membership } = await owing(data);
    const res = await api.post('/payments', {
      memberId: member.id,
      membershipId: membership.id,
      amount: '100.50',
      method: 'cash',
    });
    expect(res.status()).toBe(201);
  });

  test('rejects a membership belonging to a different member', async ({ api, data }) => {
    const a = await owing(data);
    const b = await owing(data);
    const res = await api.post('/payments', {
      memberId: a.member.id,
      membershipId: b.membership.id,
      amount: '100',
      method: 'cash',
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).message).toBe('That membership belongs to a different member');
  });

  test('returns 404 for an unknown membership', async ({ api, data }) => {
    const { member } = await owing(data);
    const res = await api.post('/payments', {
      memberId: member.id,
      membershipId: '00000000-0000-4000-8000-000000000000',
      amount: '100',
      method: 'cash',
    });
    expect([400, 404]).toContain(res.status());
  });

  test('stamps who took it, from the token rather than the body', async ({
    api,
    data,
    personas,
  }) => {
    const { member, membership } = await owing(data);
    const res = await api.post('/payments', {
      memberId: member.id,
      membershipId: membership.id,
      amount: '100',
      method: 'cash',
      receivedByStaffId: personas.personas.reception.personId,
    });
    expect(res.status()).toBe(201);
    const p = (await res.json()) as Payment;
    expect(p.receivedByName).toContain('Admin');
  });
});

test.describe('voiding a payment', () => {
  test('requires a reason', async ({ api, data }) => {
    const { member, membership } = await owing(data);
    const p = await data.payment({
      memberId: member.id,
      membershipId: membership.id,
      amount: '100',
    });
    expect((await api.patch(`/payments/${p.id}/void`, {})).status()).toBe(400);
    expect((await api.patch(`/payments/${p.id}/void`, { reason: '' })).status()).toBe(400);
  });

  test('marks it voided with the reason and who did it', async ({ api, data }) => {
    const { member, membership } = await owing(data);
    const p = await data.payment({
      memberId: member.id,
      membershipId: membership.id,
      amount: '100',
    });
    const res = await api.patch(`/payments/${p.id}/void`, { reason: 'Rang it up twice' });
    expect(res.status()).toBe(200);
    const voided = (await res.json()) as Payment;
    expect(voided.voidedAt).not.toBeNull();
    expect(voided.voidReason).toBe('Rang it up twice');
    expect(voided.voidedByName).not.toBeNull();
  });

  test('restores the balance it had paid off', async ({ api, data }) => {
    const { member, membership } = await owing(data);
    const p = await data.payment({
      memberId: member.id,
      membershipId: membership.id,
      amount: '400',
    });
    expect(
      (await api.json<Membership>(api.get(`/memberships/${membership.id}`))).balance,
    ).toBe('600.00');

    await api.patch(`/payments/${p.id}/void`, { reason: 'Refunded' });

    const after = await api.json<Membership>(api.get(`/memberships/${membership.id}`));
    expect(after.paidTotal).toBe('0.00');
    expect(after.balance).toBe('1000.00');
  });

  test('refuses to void the same payment twice', async ({ api, data }) => {
    const { member, membership } = await owing(data);
    const p = await data.payment({
      memberId: member.id,
      membershipId: membership.id,
      amount: '100',
    });
    await api.patch(`/payments/${p.id}/void`, { reason: 'First' });
    const res = await api.patch(`/payments/${p.id}/void`, { reason: 'Second' });
    expect(res.status()).toBe(409);
    expect((await res.json()).message).toBe('This payment has already been voided');
  });

  test('a voided payment stays in the list', async ({ api, data }) => {
    // The record of the mistake is part of the audit trail — it is marked, not
    // removed.
    const { member, membership } = await owing(data);
    const p = await data.payment({
      memberId: member.id,
      membershipId: membership.id,
      amount: '100',
    });
    await api.patch(`/payments/${p.id}/void`, { reason: 'Mistake' });

    const page = await api.json<PaymentPage>(
      api.get('/payments', { membershipId: membership.id }),
    );
    expect(page.data.map((x) => x.id)).toContain(p.id);
  });

  test('returns 404 for an unknown payment', async ({ api }) => {
    const res = await api.patch('/payments/00000000-0000-4000-8000-000000000000/void', {
      reason: 'x',
    });
    expect(res.status()).toBe(404);
  });

  test('there is no delete route for a payment', async ({ api, data }) => {
    const { member, membership } = await owing(data);
    const p = await data.payment({
      memberId: member.id,
      membershipId: membership.id,
      amount: '100',
    });
    expect([404, 405]).toContain((await api.delete(`/payments/${p.id}`)).status());
  });
});

test.describe('payment listing and totals', () => {
  test('totals.received counts the filtered set', async ({ api, data }) => {
    const { member, membership } = await owing(data);
    await data.payment({ memberId: member.id, membershipId: membership.id, amount: '300' });
    await data.payment({ memberId: member.id, membershipId: membership.id, amount: '200' });

    const page = await api.json<PaymentPage>(
      api.get('/payments', { membershipId: membership.id }),
    );
    expect(page.totals.received).toBe('500.00');
  });

  test('totals.received excludes voided while meta.total still counts them', async ({
    api,
    data,
  }) => {
    const { member, membership } = await owing(data);
    const keep = await data.payment({
      memberId: member.id,
      membershipId: membership.id,
      amount: '300',
    });
    const drop = await data.payment({
      memberId: member.id,
      membershipId: membership.id,
      amount: '200',
    });
    await api.patch(`/payments/${drop.id}/void`, { reason: 'Voided' });

    const page = await api.json<PaymentPage>(
      api.get('/payments', { membershipId: membership.id }),
    );
    expect(page.totals.received).toBe('300.00');
    expect(page.meta.total).toBe(2);
    expect(page.data.map((x) => x.id)).toEqual(expect.arrayContaining([keep.id, drop.id]));
  });

  test('filters by member', async ({ api, data }) => {
    const { member, membership } = await owing(data);
    await data.payment({ memberId: member.id, membershipId: membership.id, amount: '100' });

    const page = await api.json<PaymentPage>(api.get('/payments', { memberId: member.id }));
    expect(page.data.every((x) => x.memberId === member.id)).toBe(true);
    expect(page.data.length).toBe(1);
  });

  test('filters by method', async ({ api, data }) => {
    const { member, membership } = await owing(data);
    await data.payment({
      memberId: member.id,
      membershipId: membership.id,
      amount: '100',
      method: 'cash',
    });
    await data.payment({
      memberId: member.id,
      membershipId: membership.id,
      amount: '100',
      method: 'card',
    });

    const page = await api.json<PaymentPage>(
      api.get('/payments', { memberId: member.id, method: 'card' }),
    );
    expect(page.data.length).toBe(1);
    expect(page.data[0].method).toBe('card');
  });

  test('filters by plan', async ({ api, data }) => {
    const { member, membership, plan } = await owing(data);
    await data.payment({ memberId: member.id, membershipId: membership.id, amount: '100' });

    const page = await api.json<PaymentPage>(
      api.get('/payments', { planId: plan.id, limit: 100 }),
    );
    expect(page.data.map((x) => x.membershipId)).toContain(membership.id);
  });

  test('a today-only range includes a payment just taken', async ({ api, data }) => {
    // The range is evaluated in the gym's timezone, not UTC — between midnight
    // and 03:00 Addis, a UTC comparison would put this on yesterday.
    const { member, membership } = await owing(data);
    await data.payment({ memberId: member.id, membershipId: membership.id, amount: '100' });

    const page = await api.json<PaymentPage>(
      api.get('/payments', { memberId: member.id, from: gymToday(), to: gymToday() }),
    );
    expect(page.data.length).toBe(1);
  });

  test('a past-only range excludes it', async ({ api, data }) => {
    const { member, membership } = await owing(data);
    await data.payment({ memberId: member.id, membershipId: membership.id, amount: '100' });

    const page = await api.json<PaymentPage>(
      api.get('/payments', { memberId: member.id, from: '2020-01-01', to: '2020-01-02' }),
    );
    expect(page.data).toEqual([]);
    expect(page.totals.received).toBe('0.00');
  });

  test('rejects a malformed from date', async ({ api }) => {
    expect((await api.get('/payments', { from: 'yesterday' })).status()).toBe(400);
    expect((await api.get('/payments', { from: '2026-09-07T10:00:00Z' })).status()).toBe(400);
  });

  test('searches by payer name, phone and member code', async ({ api, data }) => {
    const { member, membership } = await owing(data);
    await data.payment({ memberId: member.id, membershipId: membership.id, amount: '100' });

    const full = await api.json<{ memberCode: string; lastName: string; phone: string }>(
      api.get(`/members/${member.id}`),
    );
    for (const term of [full.memberCode, full.lastName, full.phone]) {
      const page = await api.json<PaymentPage>(api.get('/payments', { search: term }));
      expect(page.data.map((x) => x.memberId)).toContain(member.id);
    }
  });
});

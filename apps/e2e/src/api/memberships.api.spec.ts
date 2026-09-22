import { test, expect } from '../support/fixtures';
import type { Paginated } from '../support/api-client';
import type { Membership } from '../support/factories';
import { addDays, gymToday } from '../support/env';
import { insertMembership, peek, sql } from '../support/db';

test.describe('selling a membership', () => {
  test('ends on startsOn + durationDays - 1, inclusive', async ({ data }) => {
    // Off by one here is a free day for every member, forever.
    const member = await data.member();
    const plan = await data.plan({ durationDays: 30 });
    const m = await data.membership({ memberId: member.id, planId: plan.id });

    expect(m.startsOn).toBe(gymToday());
    expect(m.endsOn).toBe(addDays(gymToday(), 29));
  });

  test('a one-day plan starts and ends on the same day', async ({ data }) => {
    const member = await data.member();
    const plan = await data.plan({ durationDays: 1 });
    const m = await data.membership({ memberId: member.id, planId: plan.id });
    expect(m.endsOn).toBe(m.startsOn);
  });

  test('always starts today, and a supplied startsOn is silently stripped', async ({
    api,
    data,
  }) => {
    // SellMembershipDto has no startsOn, so whitelist removes it rather than
    // rejecting — there is deliberately no way to backdate or postdate a sale.
    const member = await data.member();
    const plan = await data.plan({ durationDays: 30 });
    const m = await api.json<Membership>(
      api.post('/memberships', {
        memberId: member.id,
        planId: plan.id,
        startsOn: addDays(gymToday(), 30),
      }),
    );
    expect(m.startsOn).toBe(gymToday());
  });

  test('snapshots the price rather than joining the plan', async ({ api, data }) => {
    // price is what this member paid; the plan's price is what it costs today.
    const member = await data.member();
    const plan = await data.plan({ price: '1000' });
    const m = await data.membership({ memberId: member.id, planId: plan.id });

    await api.patch(`/membership-plans/${plan.id}`, { price: '2500' });

    const after = await api.json<Membership>(api.get(`/memberships/${m.id}`));
    expect(after.price).toBe('1000.00');
  });

  test('charges the registration fee on a first ever membership', async ({ data }) => {
    const member = await data.member();
    const plan = await data.plan({ price: '1000', registrationFee: '900' });
    const m = await data.membership({ memberId: member.id, planId: plan.id });

    expect(m.registrationFee).toBe('900.00');
    expect(m.amountDue).toBe('1900.00');
  });

  test('a soft-deleted prior membership does not count as having joined', async ({
    data,
  }) => {
    // So the joining fee is charged again. The service comment is explicit that
    // this is intended — a reversed sale refunds the fee with it, so the next
    // one is genuinely a first.
    //
    // NOTE: this contradicts the schema comment on memberships.registrationFee
    // and the same line in CLAUDE.md, both of which say "no prior membership
    // rows at all, soft-deleted ones included". The code filters
    // isNull(deletedAt); the prose is out of date, not the behaviour.
    const member = await data.member();
    const plan = await data.plan({ durationDays: 1, price: '1000', registrationFee: '900' });

    const old = await insertMembership({
      memberId: member.id,
      planId: plan.id,
      startsOn: addDays(gymToday(), -40),
      endsOn: addDays(gymToday(), -39),
      registrationFee: '900.00',
    });
    await sql(`update memberships set deleted_at = now() where id = $1`, [old.id]);

    const next = await data.membership({ memberId: member.id, planId: plan.id });
    expect(next.registrationFee).toBe('900.00');
  });

  test('a live prior membership does stop the fee being charged twice', async ({
    data,
  }) => {
    const member = await data.member();
    const plan = await data.plan({ durationDays: 1, price: '1000', registrationFee: '900' });
    const first = await data.membership({ memberId: member.id, planId: plan.id });
    expect(first.registrationFee).toBe('900.00');

    const second = await insertMembership({
      memberId: member.id,
      planId: plan.id,
      startsOn: addDays(gymToday(), 1),
      endsOn: addDays(gymToday(), 1),
    });
    const [row] = await peek.membership(second.id);
    expect(row.registration_fee).toBe('0.00');
  });

  test('refuses to sell over a live membership', async ({ api, data }) => {
    const member = await data.member();
    const plan = await data.plan({ durationDays: 30 });
    const first = await data.membership({ memberId: member.id, planId: plan.id });

    const res = await api.post('/memberships', { memberId: member.id, planId: plan.id });
    expect(res.status()).toBe(409);
    expect(String((await res.json()).message)).toContain(first.endsOn);
  });

  test('allows a sale that starts the day after the current one ends', async ({
    data,
  }) => {
    // daterange(starts_on, ends_on, '[]') is inclusive at both ends, so the
    // next range may begin exactly one day later without overlapping.
    const member = await data.member();
    const plan = await data.plan({ durationDays: 1 });
    const first = await data.membership({ memberId: member.id, planId: plan.id });

    const second = await insertMembership({
      memberId: member.id,
      planId: plan.id,
      startsOn: addDays(first.endsOn, 1),
      endsOn: addDays(first.endsOn, 30),
    });
    expect(second.id).toEqual(expect.any(String));
  });

  test('the exclusion constraint rejects an overlapping direct insert', async ({
    data,
  }) => {
    // The pre-check is the friendly message; the EXCLUDE gist constraint
    // (SQLSTATE 23P01) is what actually guarantees it under concurrency.
    const member = await data.member();
    const plan = await data.plan({ durationDays: 30 });
    await data.membership({ memberId: member.id, planId: plan.id });

    await expect(
      insertMembership({
        memberId: member.id,
        planId: plan.id,
        startsOn: gymToday(),
        endsOn: addDays(gymToday(), 5),
      }),
    ).rejects.toThrow(/23P01|exclusion|overlap/i);
  });

  test('two members may hold overlapping memberships', async ({ data }) => {
    // The constraint keys on member_id, which is what makes the suite safe to
    // run fully parallel: every test owns its own member.
    const [a, b] = [await data.member(), await data.member()];
    const plan = await data.plan({ durationDays: 30 });
    const first = await data.membership({ memberId: a.id, planId: plan.id });
    const second = await data.membership({ memberId: b.id, planId: plan.id });

    expect(first.startsOn).toBe(second.startsOn);
    expect(first.endsOn).toBe(second.endsOn);
    expect(first.id).not.toBe(second.id);
  });

  test('refuses to sell a retired plan', async ({ api, data }) => {
    const member = await data.member();
    const plan = await data.plan({ isActive: false });
    const res = await api.post('/memberships', { memberId: member.id, planId: plan.id });
    expect(res.status()).toBe(400);
    expect(String((await res.json()).message)).toContain('retired');
  });

  test('returns 400, not 404, for an unknown plan', async ({ api, data }) => {
    const member = await data.member();
    const res = await api.post('/memberships', {
      memberId: member.id,
      planId: '00000000-0000-4000-8000-000000000000',
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).message).toBe('Membership plan not found');
  });

  test('returns 404 for an unknown member', async ({ api, data }) => {
    const plan = await data.plan();
    const res = await api.post('/memberships', {
      memberId: '00000000-0000-4000-8000-000000000000',
      planId: plan.id,
    });
    expect(res.status()).toBe(404);
  });

  test('records who sold it, from the token rather than the body', async ({
    api,
    data,
    personas,
  }) => {
    const member = await data.member();
    const plan = await data.plan();
    const m = await api.json<Membership>(
      api.post('/memberships', {
        memberId: member.id,
        planId: plan.id,
        soldByStaffId: personas.personas.reception.personId,
      }),
    );
    // Identity comes from the token; the supplied id is stripped.
    expect(m.soldByStaffId).toBe(personas.personas.owner.personId);
  });
});

test.describe('complimentary memberships', () => {
  test('owes nothing, but still reports what it was worth', async ({ data }) => {
    // amountDue and balance answer different questions, and a comp is where
    // they diverge: the value given away stays visible so comps are reportable,
    // while the debt is zero so the UI can colour any positive balance red
    // without special-casing them.
    const member = await data.member();
    const plan = await data.plan({ price: '1000', registrationFee: '900' });
    const m = await data.membership({
      memberId: member.id,
      planId: plan.id,
      isComplimentary: true,
    });
    expect(m.isComplimentary).toBe(true);
    expect(m.price).toBe('1000.00');
    expect(m.registrationFee).toBe('900.00');
    expect(m.amountDue).toBe('1900.00');
    expect(m.balance).toBe('0.00');
  });

  test('refuses a payment attached to it', async ({ api, data }) => {
    const member = await data.member();
    const plan = await data.plan({ price: '1000' });
    const res = await api.post('/memberships', {
      memberId: member.id,
      planId: plan.id,
      isComplimentary: true,
      payment: { method: 'cash' },
    });
    expect(res.status()).toBe(400);
    expect(String((await res.json()).message)).toContain('complimentary');
  });

  test('refuses a payment on a zero-price plan', async ({ api, data }) => {
    const member = await data.member();
    const plan = await data.plan({ price: '0' });
    const res = await api.post('/memberships', {
      memberId: member.id,
      planId: plan.id,
      payment: { method: 'cash' },
    });
    expect(res.status()).toBe(400);
    expect(String((await res.json()).message)).toContain('costs nothing');
  });
});

test.describe('selling with payment attached', () => {
  test('takes the full amount due in one transaction', async ({ data }) => {
    // There is no amount field — it is always price + registrationFee.
    const member = await data.member();
    const plan = await data.plan({ price: '1000', registrationFee: '900' });
    const m = await data.membership({
      memberId: member.id,
      planId: plan.id,
      payment: { method: 'cash', reference: 'till-1' },
    });
    expect(m.amountDue).toBe('1900.00');
    expect(m.paidTotal).toBe('1900.00');
    expect(m.balance).toBe('0.00');
  });

  test('leaves the balance outstanding when no payment is attached', async ({ data }) => {
    const member = await data.member();
    const plan = await data.plan({ price: '1000' });
    const m = await data.membership({ memberId: member.id, planId: plan.id });
    expect(m.paidTotal).toBe('0.00');
    expect(m.balance).toBe('1000.00');
  });

  test('rejects a payment block with an unknown method', async ({ api, data }) => {
    const member = await data.member();
    const plan = await data.plan({ price: '1000' });
    const res = await api.post('/memberships', {
      memberId: member.id,
      planId: plan.id,
      payment: { method: 'bitcoin' },
    });
    expect(res.status()).toBe(400);
  });

  test('needs payment.record as well as membership.sell', async ({ data, request }) => {
    const role = await data.role(['membership.sell', 'member.read', 'plan.list']);
    const seller = await data.staff({
      password: 'Seller@12345',
      roleIds: [role.id],
      dataScope: 'all',
    });
    const { Api } = await import('../support/api-client');
    const { login } = await import('../support/api-client');
    const tokens = await login(request, { phone: seller.phone, password: 'Seller@12345' });
    const sellerApi = new Api(request, tokens.accessToken);

    const member = await data.member();
    const plan = await data.plan({ price: '1000' });

    // Without the payment block the same caller succeeds...
    const ok = await sellerApi.post('/memberships', {
      memberId: member.id,
      planId: plan.id,
    });
    expect(ok.status()).toBe(201);

    // ...but attaching money needs the money permission.
    const member2 = await data.member();
    const denied = await sellerApi.post('/memberships', {
      memberId: member2.id,
      planId: plan.id,
      payment: { method: 'cash' },
    });
    expect(denied.status()).toBe(403);
    expect((await denied.json()).message).toBe('Missing permission: payment.record');
  });
});

test.describe('membership listing', () => {
  test('filters to one member, newest first', async ({ api, data }) => {
    const member = await data.member();
    const plan = await data.plan({ durationDays: 1 });
    await insertMembership({
      memberId: member.id,
      planId: plan.id,
      startsOn: addDays(gymToday(), -40),
      endsOn: addDays(gymToday(), -39),
    });
    const newer = await data.membership({ memberId: member.id, planId: plan.id });

    const page = await api.json<Paginated<Membership>>(
      api.get('/memberships', { memberId: member.id }),
    );
    expect(page.data.length).toBe(2);
    expect(page.data[0].id).toBe(newer.id);
  });

  test('reads one membership by id', async ({ api, data }) => {
    const member = await data.member();
    const plan = await data.plan();
    const m = await data.membership({ memberId: member.id, planId: plan.id });
    expect((await api.json<Membership>(api.get(`/memberships/${m.id}`))).id).toBe(m.id);
  });

  test('returns 404 for an unknown membership', async ({ api }) => {
    const res = await api.get('/memberships/00000000-0000-4000-8000-000000000000');
    expect(res.status()).toBe(404);
    expect((await res.json()).message).toBe('Membership not found');
  });

  test('has no update or delete route', async ({ api, data }) => {
    // ends_on is set at sale and never moves — there is deliberately no freeze
    // and no goodwill extension.
    const member = await data.member();
    const plan = await data.plan();
    const m = await data.membership({ memberId: member.id, planId: plan.id });
    expect([404, 405]).toContain((await api.patch(`/memberships/${m.id}`, {})).status());
    expect([404, 405]).toContain((await api.delete(`/memberships/${m.id}`)).status());
  });
});

test.describe('derived member status', () => {
  test('a live membership makes the member active', async ({ api, data }) => {
    const { member } = await data.activeMember();
    const got = await api.json<{ membershipStatus: string; expiresOn: string | null }>(
      api.get(`/members/${member.id}`),
    );
    expect(got.membershipStatus).toBe('active');
    expect(got.expiresOn).toBe(addDays(gymToday(), 29));
  });

  test('a lapsed membership makes the member expired', async ({ api, data }) => {
    const { member } = await data.expiredMember();
    const got = await api.json<{ membershipStatus: string }>(api.get(`/members/${member.id}`));
    expect(got.membershipStatus).toBe('expired');
  });

  test('status is computed, not stored — it changes with the data alone', async ({
    api,
    data,
  }) => {
    // Storing it would need a nightly job, and the day that job fails the
    // column lies.
    const member = await data.member();
    expect(
      (await api.json<{ membershipStatus: string }>(api.get(`/members/${member.id}`)))
        .membershipStatus,
    ).toBe('never');

    const plan = await data.plan({ durationDays: 30 });
    await data.membership({ memberId: member.id, planId: plan.id });

    expect(
      (await api.json<{ membershipStatus: string }>(api.get(`/members/${member.id}`)))
        .membershipStatus,
    ).toBe('active');
  });
});

import { test, expect } from '../support/fixtures';
import type { Paginated } from '../support/api-client';
import { Api, login } from '../support/api-client';
import { gymToday } from '../support/env';
import { peek } from '../support/db';
import { record } from '../support/manifest';

interface CheckIn {
  id: number;
  memberId: string;
  memberName: string;
  memberCode: string;
  membershipId: string | null;
  branchId: string;
  branchName: string;
  recordedByName: string | null;
  overrideByName: string | null;
  checkedInOn: string;
  checkedInAt: string;
  membershipStatus: string;
  expiresOn: string | null;
}

interface Refusal {
  statusCode: number;
  message: string;
  error: string;
  reason: 'suspended' | 'expired' | 'none';
}

test.describe('recording a check-in', () => {
  test('answers 201 on the first scan of the gym day', async ({ api, data }) => {
    const { member, membership } = await data.activeMember();
    const res = await api.post('/check-ins', { memberId: member.id });
    expect(res.status()).toBe(201);

    const body = (await res.json()) as CheckIn;
    record('check_ins', String(body.id));
    expect(body).toMatchObject({
      memberId: member.id,
      memberCode: member.memberCode,
      checkedInOn: gymToday(),
      membershipId: membership.id,
      overrideByName: null,
    });
  });

  test('answers 200 on a repeat scan, returning the same row', async ({ api, data }) => {
    // Members leave and come back. A 409 at the front desk would be a worse
    // answer than none, so the second scan returns the existing row unchanged.
    const { member } = await data.activeMember();

    const first = await api.post('/check-ins', { memberId: member.id });
    expect(first.status()).toBe(201);
    const a = (await first.json()) as CheckIn;
    record('check_ins', String(a.id));

    const second = await api.post('/check-ins', { memberId: member.id });
    expect(second.status()).toBe(200);
    const b = (await second.json()) as CheckIn;

    expect(b.id).toBe(a.id);
    expect(b.checkedInAt).toBe(a.checkedInAt);
  });

  test('records against the members home branch, not the callers', async ({
    api,
    data,
    personas,
  }) => {
    const { member } = await data.activeMember({ branchId: personas.otherBranchId });
    const res = await api.post('/check-ins', { memberId: member.id });
    const body = (await res.json()) as CheckIn;
    record('check_ins', String(body.id));
    expect(body.branchId).toBe(personas.otherBranchId);
  });

  test('stamps who recorded it, from the token', async ({ api, data }) => {
    const { member } = await data.activeMember();
    const res = await api.post('/check-ins', { memberId: member.id });
    const body = (await res.json()) as CheckIn;
    record('check_ins', String(body.id));
    expect(body.recordedByName).toContain('Admin');
  });

  test('strips a client-supplied branch and check-in date', async ({
    api,
    data,
    personas,
  }) => {
    const { member } = await data.activeMember();
    const res = await api.post('/check-ins', {
      memberId: member.id,
      branchId: personas.otherBranchId,
      checkedInOn: '2020-01-01',
    });
    const body = (await res.json()) as CheckIn;
    record('check_ins', String(body.id));
    expect(body.branchId).toBe(personas.mainBranchId);
    expect(body.checkedInOn).toBe(gymToday());
  });

  test('returns 404 for an unknown member', async ({ api }) => {
    const res = await api.post('/check-ins', {
      memberId: '00000000-0000-4000-8000-000000000000',
    });
    expect(res.status()).toBe(404);
  });

  test('returns 404 for a soft-deleted member', async ({ api, data }) => {
    const { member } = await data.activeMember();
    await api.delete(`/members/${member.id}`);
    expect((await api.post('/check-ins', { memberId: member.id })).status()).toBe(404);
  });

  test('rejects a non-uuid member id', async ({ api }) => {
    expect((await api.post('/check-ins', { memberId: 'nope' })).status()).toBe(400);
  });
});

test.describe('refusals', () => {
  test('refuses a member who never bought anything, with reason "none"', async ({
    api,
    data,
  }) => {
    const member = await data.member();
    const res = await api.post('/check-ins', { memberId: member.id });
    expect(res.status()).toBe(403);
    // Assert on reason, never the prose: the expired message embeds a date.
    expect(((await res.json()) as Refusal).reason).toBe('none');
  });

  test('refuses an expired member, with reason "expired"', async ({ api, data }) => {
    const { member } = await data.expiredMember();
    const res = await api.post('/check-ins', { memberId: member.id });
    expect(res.status()).toBe(403);
    expect(((await res.json()) as Refusal).reason).toBe('expired');
  });

  test('refuses a suspended member, with reason "suspended"', async ({ api, data }) => {
    const { member } = await data.activeMember();
    await api.patch(`/members/${member.id}/suspension`, { isSuspended: true });

    const res = await api.post('/check-ins', { memberId: member.id });
    expect(res.status()).toBe(403);
    expect(((await res.json()) as Refusal).reason).toBe('suspended');
  });

  test('checks suspension before membership, so valid cover still says suspended', async ({
    api,
    data,
  }) => {
    // Ordering matters: a suspended member with a live membership is barred for
    // the suspension, not admitted for the cover.
    const { member } = await data.activeMember();
    await api.patch(`/members/${member.id}/suspension`, { isSuspended: true });
    const res = await api.post('/check-ins', { memberId: member.id });
    expect(((await res.json()) as Refusal).reason).toBe('suspended');
  });

  test('a suspended AND expired member reports suspended, not expired', async ({
    api,
    data,
  }) => {
    const { member } = await data.expiredMember();
    await api.patch(`/members/${member.id}/suspension`, { isSuspended: true });
    const res = await api.post('/check-ins', { memberId: member.id });
    expect(((await res.json()) as Refusal).reason).toBe('suspended');
  });

  test('lifting a suspension lets them back in', async ({ api, data }) => {
    const { member } = await data.activeMember();
    await api.patch(`/members/${member.id}/suspension`, { isSuspended: true });
    expect((await api.post('/check-ins', { memberId: member.id })).status()).toBe(403);

    await api.patch(`/members/${member.id}/suspension`, { isSuspended: false });
    const res = await api.post('/check-ins', { memberId: member.id });
    expect(res.status()).toBe(201);
    record('check_ins', String((await res.json()).id));
  });

  test('a refusal writes no check-in row', async ({ api, data }) => {
    const { member } = await data.expiredMember();
    await api.post('/check-ins', { memberId: member.id });
    expect(await peek.checkIn(member.id, gymToday())).toEqual([]);
  });
});

test.describe('override', () => {
  /** A caller holding checkin.record and, optionally, checkin.override. */
  const desk = async (
    data: {
      role: (p: string[]) => Promise<{ id: string }>;
      staff: (o: Record<string, unknown>) => Promise<{ id: string; phone: string }>;
    },
    request: Parameters<typeof login>[0],
    withOverride: boolean,
  ) => {
    const perms = ['checkin.record', 'checkin.list', 'member.list', 'member.read'];
    if (withOverride) perms.push('checkin.override');
    const role = await data.role(perms);
    const person = await data.staff({
      password: 'Desk@12345678',
      roleIds: [role.id],
      dataScope: 'all',
    });
    const tokens = await login(request, {
      phone: person.phone,
      password: 'Desk@12345678',
    });
    return { person, api: new Api(request, tokens.accessToken) };
  };

  test('admits an expired member and records no membership', async ({
    data,
    request,
  }) => {
    const { member } = await data.expiredMember();
    const clerk = await desk(data, request, true);

    const res = await clerk.api.post('/check-ins', { memberId: member.id, override: true });
    expect(res.status()).toBe(201);
    const body = (await res.json()) as CheckIn;
    record('check_ins', String(body.id));

    // An override is not covered by any membership, so the link is null.
    expect(body.membershipId).toBeNull();
    expect(body.overrideByName).not.toBeNull();
  });

  test('admits a member who never bought anything', async ({ data, request }) => {
    const member = await data.member();
    const clerk = await desk(data, request, true);
    const res = await clerk.api.post('/check-ins', { memberId: member.id, override: true });
    expect(res.status()).toBe(201);
    record('check_ins', String((await res.json()).id));
  });

  test('does not lift a suspension, even with the permission', async ({
    api,
    data,
    request,
  }) => {
    // Suspension is a decision a human made about this person. Money is not.
    const { member } = await data.activeMember();
    await api.patch(`/members/${member.id}/suspension`, { isSuspended: true });

    const clerk = await desk(data, request, true);
    const res = await clerk.api.post('/check-ins', { memberId: member.id, override: true });
    expect(res.status()).toBe(403);
    expect(((await res.json()) as Refusal).reason).toBe('suspended');
  });

  test('is silently ignored without the permission — the refusal stands', async ({
    data,
    request,
  }) => {
    // The trap: this is NOT a 403 about the missing permission. The flag is
    // dropped and the ordinary refusal comes back, so a test asserting only on
    // the status passes for entirely the wrong reason.
    const { member } = await data.expiredMember();
    const clerk = await desk(data, request, false);

    const res = await clerk.api.post('/check-ins', { memberId: member.id, override: true });
    expect(res.status()).toBe(403);
    const body = (await res.json()) as Refusal;
    expect(body.reason).toBe('expired');
    expect(body.message).not.toContain('Missing permission');
  });

  test('stamps the overriding staff member on the row', async ({ data, request }) => {
    const { member } = await data.expiredMember();
    const clerk = await desk(data, request, true);
    const res = await clerk.api.post('/check-ins', { memberId: member.id, override: true });
    record('check_ins', String((await res.json()).id));

    const [row] = await peek.checkIn(member.id, gymToday());
    expect(row.override_by_staff_id).toBe(clerk.person.id);
    expect(row.membership_id).toBeNull();
  });

  test('an ordinary check-in leaves overrideBy null and links the membership', async ({
    api,
    data,
  }) => {
    const { member, membership } = await data.activeMember();
    const res = await api.post('/check-ins', { memberId: member.id });
    record('check_ins', String((await res.json()).id));

    const [row] = await peek.checkIn(member.id, gymToday());
    expect(row.override_by_staff_id).toBeNull();
    expect(row.membership_id).toBe(membership.id);
  });

  test('override on an already-admitted member is still the same row', async ({
    data,
    request,
  }) => {
    const { member } = await data.expiredMember();
    const clerk = await desk(data, request, true);

    const first = await clerk.api.post('/check-ins', { memberId: member.id, override: true });
    expect(first.status()).toBe(201);
    const a = (await first.json()) as CheckIn;
    record('check_ins', String(a.id));

    const second = await clerk.api.post('/check-ins', { memberId: member.id, override: true });
    expect(second.status()).toBe(200);
    expect(((await second.json()) as CheckIn).id).toBe(a.id);
  });
});

test.describe('one check-in per member per gym day', () => {
  test('concurrent scans settle to a single row', async ({ api, data }) => {
    // check_ins_member_day_uniq is the backstop for the race two scans create;
    // the 23505 is translated rather than surfacing as a 500.
    const { member } = await data.activeMember();

    const results = await Promise.all(
      Array.from({ length: 4 }, () => api.post('/check-ins', { memberId: member.id })),
    );
    for (const r of results) expect([200, 201]).toContain(r.status());

    const rows = await peek.checkIn(member.id, gymToday());
    expect(rows.length).toBe(1);
    record('check_ins', String(rows[0].id));
  });
});

test.describe('listing check-ins', () => {
  test('defaults to today', async ({ api, data }) => {
    const { member } = await data.activeMember();
    const created = await api.post('/check-ins', { memberId: member.id });
    record('check_ins', String((await created.json()).id));

    const page = await api.json<Paginated<CheckIn>>(api.get('/check-ins'));
    expect(page.data.every((c) => c.checkedInOn === gymToday())).toBe(true);
    expect(page.data.map((c) => c.memberId)).toContain(member.id);
  });

  test('filters by member', async ({ api, data }) => {
    const { member } = await data.activeMember();
    const created = await api.post('/check-ins', { memberId: member.id });
    record('check_ins', String((await created.json()).id));

    const page = await api.json<Paginated<CheckIn>>(
      api.get('/check-ins', { memberId: member.id }),
    );
    expect(page.data.length).toBe(1);
    expect(page.data[0].memberId).toBe(member.id);
  });

  test('filters by branch', async ({ api, data, personas }) => {
    const { member } = await data.activeMember({ branchId: personas.otherBranchId });
    const created = await api.post('/check-ins', { memberId: member.id });
    record('check_ins', String((await created.json()).id));

    const page = await api.json<Paginated<CheckIn>>(
      api.get('/check-ins', { branchId: personas.otherBranchId, limit: 100 }),
    );
    expect(page.data.every((c) => c.branchId === personas.otherBranchId)).toBe(true);
    expect(page.data.map((c) => c.memberId)).toContain(member.id);
  });

  test('rejects a from date that is not YYYY-MM-DD', async ({ api }) => {
    expect((await api.get('/check-ins', { from: '2026-09-07T00:00:00Z' })).status()).toBe(400);
    expect((await api.get('/check-ins', { from: '20260907' })).status()).toBe(400);
  });

  test('rejects an impossible calendar date', async ({ api }) => {
    expect((await api.get('/check-ins', { from: '2026-02-30' })).status()).toBe(400);
  });

  test('a past-only range excludes todays visits', async ({ api, data }) => {
    const { member } = await data.activeMember();
    const created = await api.post('/check-ins', { memberId: member.id });
    record('check_ins', String((await created.json()).id));

    const page = await api.json<Paginated<CheckIn>>(
      api.get('/check-ins', { from: '2020-01-01', to: '2020-01-02', memberId: member.id }),
    );
    expect(page.data).toEqual([]);
  });
});

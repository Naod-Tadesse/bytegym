import { test, expect } from '../support/fixtures';
import type { Paginated } from '../support/api-client';
import { Api, login } from '../support/api-client';
import { gymToday } from '../support/env';
import { record } from '../support/manifest';

/**
 * Permissions answer "what may you do"; data_scope answers "over which rows".
 * The two are independent, and these cases are about the second.
 *
 * The `manager` persona is dataScope 'branch' based at `otherBranchId`, so
 * anything at Main Branch is out of scope for them.
 */
test.describe('reads are scoped to the callers branch', () => {
  test('a branch-scoped caller lists only their own branch', async ({
    as,
    data,
    personas,
  }) => {
    const mine = await data.member({ branchId: personas.otherBranchId });
    const theirs = await data.member({ branchId: personas.mainBranchId });

    const manager = await as('manager');
    const page = await manager.json<Paginated<{ personId: string; branchId: string }>>(
      manager.get('/members', { limit: 100 }),
    );

    expect(page.data.every((m) => m.branchId === personas.otherBranchId)).toBe(true);
    expect(page.data.map((m) => m.personId)).toContain(mine.id);
    expect(page.data.map((m) => m.personId)).not.toContain(theirs.id);
  });

  test('an all-scope caller sees both branches', async ({ api, data, personas }) => {
    const a = await data.member({ branchId: personas.otherBranchId });
    const b = await data.member({ branchId: personas.mainBranchId });

    // Search for each member by their own unique name rather than paging a
    // shared prefix: with other workers creating members concurrently, a
    // `limit: 100` page of "E2E" is not guaranteed to contain either of ours.
    for (const m of [a, b]) {
      const page = await api.json<Paginated<{ personId: string }>>(
        api.get('/members', { search: m.lastName }),
      );
      expect(page.data.map((x) => x.personId)).toContain(m.id);
    }
  });

  test('an out-of-scope member reads as 404, not 403', async ({ as, data, personas }) => {
    // A 403 would confirm the id exists, turning the endpoint into an existence
    // oracle for other branches' records.
    const theirs = await data.member({ branchId: personas.mainBranchId });
    const manager = await as('manager');

    const res = await manager.get(`/members/${theirs.id}`);
    expect(res.status()).toBe(404);
    expect((await res.json()).message).toBe('Member not found');
  });

  test('an in-scope member reads normally', async ({ as, data, personas }) => {
    const mine = await data.member({ branchId: personas.otherBranchId });
    const manager = await as('manager');
    expect((await manager.get(`/members/${mine.id}`)).status()).toBe(200);
  });

  test('an out-of-scope staff member reads as 404', async ({ as, data, personas }) => {
    const theirs = await data.staff({ branchId: personas.mainBranchId });
    const manager = await as('manager');
    expect((await manager.get(`/staff/${theirs.id}`)).status()).toBe(404);
  });

  test('an out-of-scope payment is invisible and unreachable', async ({
    as,
    data,
    personas,
  }) => {
    const member = await data.member({ branchId: personas.mainBranchId });
    const plan = await data.plan({ price: '1000' });
    const membership = await data.membership({ memberId: member.id, planId: plan.id });
    const payment = await data.payment({
      memberId: member.id,
      membershipId: membership.id,
      amount: '100',
    });

    const manager = await as('manager');
    const page = await manager.json<Paginated<{ id: string }>>(
      manager.get('/payments', { limit: 100 }),
    );
    expect(page.data.map((p) => p.id)).not.toContain(payment.id);

    const res = await manager.patch(`/payments/${payment.id}/void`, { reason: 'Nope' });
    expect(res.status()).toBe(404);
  });

  test('memberships scope through the members branch, not a column of their own', async ({
    as,
    data,
    personas,
  }) => {
    const theirs = await data.member({ branchId: personas.mainBranchId });
    const plan = await data.plan();
    const membership = await data.membership({ memberId: theirs.id, planId: plan.id });

    const manager = await as('manager');
    expect((await manager.get(`/memberships/${membership.id}`)).status()).toBe(404);
  });

  test('attendance excludes other branches', async ({ api, as, data, personas }) => {
    const theirs = await data.activeMember({ branchId: personas.mainBranchId });
    const created = await api.post('/check-ins', { memberId: theirs.member.id });
    record('check_ins', String((await created.json()).id));

    const manager = await as('manager');
    const page = await manager.json<Paginated<{ branchId: string; memberId: string }>>(
      manager.get('/check-ins', { limit: 100 }),
    );
    expect(page.data.every((c) => c.branchId === personas.otherBranchId)).toBe(true);
    expect(page.data.map((c) => c.memberId)).not.toContain(theirs.member.id);
  });

  test('checking in an out-of-scope member is a 404', async ({ as, data, personas }) => {
    const theirs = await data.activeMember({ branchId: personas.mainBranchId });
    const manager = await as('manager');
    expect(
      (await manager.post('/check-ins', { memberId: theirs.member.id })).status(),
    ).toBe(404);
  });
});

test.describe('writes are scoped too, or read-scoping is theatre', () => {
  test('a branch-scoped caller cannot update an out-of-scope member', async ({
    as,
    data,
    personas,
  }) => {
    // Without assertInScope on the write path, a branch manager could PATCH
    // another branch's records by guessing an id.
    const theirs = await data.member({ branchId: personas.mainBranchId });
    const manager = await as('manager');
    expect(
      (await manager.patch(`/members/${theirs.id}`, { lastName: 'Hijacked' })).status(),
    ).toBe(404);
  });

  test('a branch-scoped caller cannot delete an out-of-scope member', async ({
    as,
    data,
    personas,
  }) => {
    const theirs = await data.member({ branchId: personas.mainBranchId });
    const manager = await as('manager');
    expect((await manager.delete(`/members/${theirs.id}`)).status()).toBe(404);
  });

  test('a branch-scoped caller cannot suspend an out-of-scope member', async ({
    as,
    data,
    personas,
  }) => {
    const theirs = await data.member({ branchId: personas.mainBranchId });
    const manager = await as('manager');
    expect(
      (await manager.patch(`/members/${theirs.id}/suspension`, { isSuspended: true })).status(),
    ).toBe(404);
  });

  test('creating into another branch is 403, not 404', async ({ as, personas }) => {
    // The exception to the 404 rule: the caller supplied that branch id
    // themselves, so there is nothing left to conceal.
    const manager = await as('manager');
    const res = await manager.post('/members', {
      firstName: 'E2E',
      lastName: 'Trespass',
      phone: '0911223344',
      branchId: personas.mainBranchId,
    });
    expect(res.status()).toBe(403);
    expect((await res.json()).message).toBe('You can only manage your own branch');
  });

  test('creating into their own branch succeeds', async ({ as, personas }) => {
    const manager = await as('manager');
    const phone = `09${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`;
    const res = await manager.post('/members', {
      firstName: 'E2E',
      lastName: 'Ownbranch',
      phone,
      branchId: personas.otherBranchId,
    });
    expect(res.status()).toBe(201);
    const created = await res.json();
    record('member', created.personId);
    record('person', created.personId);
  });
});

test.describe('escalation guards', () => {
  /** A branch-scoped caller who can nonetheless create and authorise staff. */
  const branchAdmin = async (
    data: {
      role: (p: string[]) => Promise<{ id: string }>;
      staff: (o: Record<string, unknown>) => Promise<{ id: string; phone: string }>;
    },
    request: Parameters<typeof login>[0],
    branchId: string,
  ) => {
    const role = await data.role([
      'staff.create',
      'staff.list',
      'staff.read',
      'staff.update',
      'role.assign',
    ]);
    const person = await data.staff({
      branchId,
      jobTitleCode: 'manager',
      password: 'Branchy@1234',
      roleIds: [role.id],
      dataScope: 'branch',
    });
    const tokens = await login(request, { phone: person.phone, password: 'Branchy@1234' });
    return { person, api: new Api(request, tokens.accessToken) };
  };

  test('a branch-scoped caller cannot mint an all-scope colleague', async ({
    data,
    request,
    personas,
  }) => {
    // Otherwise the limit is one POST away from being escaped.
    const admin = await branchAdmin(data, request, personas.otherBranchId);
    const jt = await data.jobTitle('receptionist');

    const res = await admin.api.post('/staff', {
      firstName: 'E2E',
      lastName: 'Escalated',
      phone: `09${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`,
      primaryBranchId: personas.otherBranchId,
      jobTitleId: jt.id,
      hiredOn: gymToday(),
      dataScope: 'all',
    });
    expect(res.status()).toBe(403);
    expect((await res.json()).message).toBe('You cannot grant access to all branches');
  });

  test('a branch-scoped caller may create a branch-scoped colleague', async ({
    data,
    request,
    personas,
  }) => {
    const admin = await branchAdmin(data, request, personas.otherBranchId);
    const jt = await data.jobTitle('receptionist');

    const res = await admin.api.post('/staff', {
      firstName: 'E2E',
      lastName: 'Peer',
      phone: `09${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`,
      primaryBranchId: personas.otherBranchId,
      jobTitleId: jt.id,
      hiredOn: gymToday(),
    });
    expect(res.status()).toBe(201);
    const created = await res.json();
    record('staff', created.personId);
    record('person', created.personId);
  });

  test('a branch-scoped caller cannot create staff into another branch', async ({
    data,
    request,
    personas,
  }) => {
    const admin = await branchAdmin(data, request, personas.otherBranchId);
    const jt = await data.jobTitle('receptionist');

    const res = await admin.api.post('/staff', {
      firstName: 'E2E',
      lastName: 'Elsewhere',
      phone: `09${String(Math.floor(Math.random() * 1e8)).padStart(8, '0')}`,
      primaryBranchId: personas.mainBranchId,
      jobTitleId: jt.id,
      hiredOn: gymToday(),
    });
    expect(res.status()).toBe(403);
    expect((await res.json()).message).toBe('You can only manage your own branch');
  });

  test('a branch-scoped caller cannot promote someone else to all-scope', async ({
    data,
    request,
    personas,
  }) => {
    const admin = await branchAdmin(data, request, personas.otherBranchId);
    const colleague = await data.staff({
      branchId: personas.otherBranchId,
      password: 'Colleague@12',
    });

    const res = await admin.api.patch(`/staff/${colleague.id}/authorization`, {
      dataScope: 'all',
    });
    expect(res.status()).toBe(403);
    expect((await res.json()).message).toBe('You cannot grant access to all branches');
  });

  test('an all-scope caller may grant all-scope', async ({ api, data, personas }) => {
    const colleague = await data.staff({
      branchId: personas.otherBranchId,
      password: 'Promote@123',
    });
    const res = await api.patch(`/staff/${colleague.id}/authorization`, { dataScope: 'all' });
    expect(res.status()).toBe(200);
    expect((await res.json()).dataScope).toBe('all');
  });
});

test.describe('branch.* stripping', () => {
  test('a branch-scoped caller is refused the branches list despite holding branch.list', async ({
    as,
  }) => {
    // The role keeps its branch.list grant so one "Manager" role works at
    // either scope; resolvePermissions() removes it from the token.
    const manager = await as('manager');
    const res = await manager.get('/branches');
    expect(res.status()).toBe(403);
    expect((await res.json()).message).toBe('Missing permission: branch.list');
  });

  test('the same role at all-scope keeps branch.list', async ({
    data,
    request,
    personas,
  }) => {
    const role = await data.role(['branch.list']);
    const person = await data.staff({
      branchId: personas.mainBranchId,
      password: 'Global@12345',
      roleIds: [role.id],
      dataScope: 'all',
    });
    const tokens = await login(request, { phone: person.phone, password: 'Global@12345' });
    const global = new Api(request, tokens.accessToken);
    expect((await global.get('/branches')).status()).toBe(200);
  });

  test('changing dataScope revokes the affected sessions', async ({
    api,
    data,
    request,
  }) => {
    // The access token is a snapshot of roles, scope and branch together.
    const person = await data.staff({ password: 'Scoped@12345', dataScope: 'branch' });
    const tokens = await login(request, { phone: person.phone, password: 'Scoped@12345' });

    await api.patch(`/staff/${person.id}/authorization`, { dataScope: 'all' });

    expect(
      (await request.post('http://localhost:3000/api/auth/refresh', {
        data: { refreshToken: tokens.refreshToken },
      })).status(),
    ).toBe(401);
  });
});

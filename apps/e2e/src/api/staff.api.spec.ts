import { test, expect } from '../support/fixtures';
import type { Paginated } from '../support/api-client';
import { Api as ApiClass, login } from '../support/api-client';
import { record } from '../support/manifest';
import { uniquePhone } from '../support/unique';
import { peek } from '../support/db';
import { gymToday } from '../support/env';

interface StaffRow {
  personId: string;
  staffCode: string;
  firstName: string;
  lastName: string;
  phone: string;
  jobTitle: string;
  hasAccount: boolean;
  employmentStatus: 'active' | 'on_leave' | 'terminated';
  dataScope: 'branch' | 'all';
  status: 'active' | 'disabled' | null;
  roles: { id: string; name: string }[];
  lastLoginAt?: string | null;
  terminatedOn?: string | null;
}

test.describe('staff creation', () => {
  test('creates a staff member with a login who can then sign in', async ({
    api,
    data,
    request,
  }) => {
    const branch = await data.mainBranch();
    const jt = await data.jobTitle('receptionist');
    const phone = uniquePhone();

    const res = await api.post('/staff', {
      firstName: 'E2E',
      lastName: 'Signsin',
      phone,
      primaryBranchId: branch.id,
      jobTitleId: jt.id,
      hiredOn: gymToday(),
      password: 'Fresh@12345',
    });
    expect(res.status()).toBe(201);
    const created = await res.json();
    record('staff', created.personId);
    record('person', created.personId);

    // POST returns the narrow profile DTO: ids and employment, but no name,
    // phone, jobTitle or hasAccount — despite StaffProfileDto declaring the
    // last two. The DTOs are documentation only, nothing binds them to what the
    // service selects, so read the detail endpoint when you need those.
    expect(created.staffCode).toMatch(/^ST\d{5}$/);
    expect(created).toMatchObject({
      employmentStatus: 'active',
      terminatedOn: null,
      dataScope: 'branch',
      primaryBranchId: branch.id,
    });

    expect((await api.json<StaffRow>(api.get(`/staff/${created.personId}`))).hasAccount).toBe(
      true,
    );

    const tokens = await login(request, { phone, password: 'Fresh@12345' });
    expect(tokens.accessToken).toEqual(expect.any(String));
  });

  test('creates an employee with no login at all', async ({ api, data }) => {
    // A cleaner is a full employee with no accounts row — the absence of the
    // row IS the absence of the right to sign in, so there is no nullable flag
    // anyone can forget to check.
    const s = await data.staff({ jobTitleCode: 'cleaner' });
    const got = await api.json<StaffRow>(api.get(`/staff/${s.id}`));
    expect(got).toMatchObject({ hasAccount: false, status: null });
    expect(await peek.account(s.id)).toEqual([]);
  });

  test('defaults dataScope to branch, the narrower value', async ({ api, data }) => {
    const s = await data.staff();
    expect((await api.json<StaffRow>(api.get(`/staff/${s.id}`))).dataScope).toBe('branch');
  });

  test('refuses a password for a job title that cannot hold an account', async ({
    api,
    data,
  }) => {
    const branch = await data.mainBranch();
    const jt = await data.jobTitle('trainer');
    const res = await api.post('/staff', {
      firstName: 'E2E',
      lastName: 'Trainer',
      phone: uniquePhone(),
      primaryBranchId: branch.id,
      jobTitleId: jt.id,
      hiredOn: gymToday(),
      password: 'Trainer@1234',
    });
    expect(res.status()).toBe(400);
    expect(String((await res.json()).message)).toContain('cannot be given system access');
  });

  test('refuses roles for a job title that cannot hold an account', async ({
    api,
    data,
  }) => {
    // Roles hang off the account, not the staff row, so there is nothing to
    // attach them to. A silent no-op would be worse than a 400.
    const branch = await data.mainBranch();
    const jt = await data.jobTitle('cleaner');
    const role = await data.role(['member.list']);
    const res = await api.post('/staff', {
      firstName: 'E2E',
      lastName: 'Cleaner',
      phone: uniquePhone(),
      primaryBranchId: branch.id,
      jobTitleId: jt.id,
      hiredOn: gymToday(),
      roleIds: [role.id],
    });
    expect(res.status()).toBe(400);
  });

  test('rejects an unknown job title with a clean 400', async ({ api, data }) => {
    const branch = await data.mainBranch();
    const res = await api.post('/staff', {
      firstName: 'E2E',
      lastName: 'Nojob',
      phone: uniquePhone(),
      primaryBranchId: branch.id,
      jobTitleId: '00000000-0000-4000-8000-000000000000',
      hiredOn: gymToday(),
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).message).toBe('Job title not found');
  });

  test('rejects a duplicate phone', async ({ api, data }) => {
    const existing = await data.staff();
    const branch = await data.mainBranch();
    const jt = await data.jobTitle('receptionist');
    const res = await api.post('/staff', {
      firstName: 'E2E',
      lastName: 'Dupe',
      phone: existing.phone,
      primaryBranchId: branch.id,
      jobTitleId: jt.id,
      hiredOn: gymToday(),
    });
    expect(res.status()).toBe(409);
  });

  test('rejects a password shorter than eight characters', async ({ api, data }) => {
    const branch = await data.mainBranch();
    const jt = await data.jobTitle('receptionist');
    const res = await api.post('/staff', {
      firstName: 'E2E',
      lastName: 'Shortpw',
      phone: uniquePhone(),
      primaryBranchId: branch.id,
      jobTitleId: jt.id,
      hiredOn: gymToday(),
      password: 'short1',
    });
    expect(res.status()).toBe(400);
  });
});

test.describe('staff listing', () => {
  test('searches by name, phone and staff code', async ({ api, data }) => {
    const s = await data.staff();
    for (const term of [s.lastName, s.phone, s.staffCode]) {
      const page = await api.json<Paginated<StaffRow>>(api.get('/staff', { search: term }));
      expect(page.data.map((x) => x.personId)).toContain(s.id);
    }
  });

  test('hasAccount=true returns only people who can sign in', async ({ api, data }) => {
    const withLogin = await data.staff({ password: 'HasLogin@123' });
    const without = await data.staff({ jobTitleCode: 'cleaner' });

    // Search by each one's own unique name: other workers create staff
    // concurrently, so a shared-prefix page is not guaranteed to hold ours.
    const mine = await api.json<Paginated<StaffRow>>(
      api.get('/staff', { hasAccount: true, search: withLogin.lastName }),
    );
    expect(mine.data.every((x) => x.hasAccount)).toBe(true);
    expect(mine.data.map((x) => x.personId)).toContain(withLogin.id);

    const excluded = await api.json<Paginated<StaffRow>>(
      api.get('/staff', { hasAccount: true, search: without.lastName }),
    );
    expect(excluded.data.map((x) => x.personId)).not.toContain(without.id);
  });

  test('hasAccount=false is honoured rather than coerced to true', async ({
    api,
    data,
  }) => {
    const without = await data.staff({ jobTitleCode: 'cleaner' });
    const page = await api.json<Paginated<StaffRow>>(
      api.get('/staff', { hasAccount: false, search: without.lastName }),
    );
    expect(page.data.every((x) => !x.hasAccount)).toBe(true);
    expect(page.data.map((x) => x.personId)).toContain(without.id);
  });

  test('terminated staff vanish from the list entirely', async ({ api, data }) => {
    // Worth pinning because it is easy to assume the opposite. Terminating
    // soft-deletes the *person*, and every staff read filters
    // isNull(person.deletedAt) — so employmentStatus: 'terminated' is a state
    // no API response can ever show. The staff row keeps it for history, but
    // the record is unreachable, and the frontend's "They have already been
    // terminated" disabled reason is therefore unreachable too.
    const s = await data.staff({ password: 'Bye@12345678' });
    await api.delete(`/staff/${s.id}`);

    const page = await api.json<Paginated<StaffRow>>(
      api.get('/staff', { search: s.lastName, limit: 100 }),
    );
    expect(page.data.map((x) => x.personId)).not.toContain(s.id);

    const [row] = await peek.staff(s.id);
    expect(row.employment_status).toBe('terminated');
  });
});

test.describe('staff update', () => {
  test('updates name and job title', async ({ api, data }) => {
    const s = await data.staff();
    const trainer = await data.jobTitle('trainer');
    const updated = await api.json<StaffRow>(
      api.patch(`/staff/${s.id}`, { lastName: 'Renamed', jobTitleId: trainer.id }),
    );
    expect(updated).toMatchObject({ lastName: 'Renamed', jobTitle: 'Trainer' });
  });

  test('ignores an attempt to change the phone or staff code', async ({ api, data }) => {
    const s = await data.staff();
    const updated = await api.json<StaffRow>(
      api.patch(`/staff/${s.id}`, { phone: uniquePhone(), staffCode: 'ST99999' }),
    );
    expect(updated.phone).toBe(s.phone);
    expect(updated.staffCode).toBe(s.staffCode);
  });

  test('changing roles revokes the holders sessions', async ({ api, data, request }) => {
    const roleA = await data.role(['member.list']);
    const roleB = await data.role(['plan.list']);
    const s = await data.staff({ password: 'Roles@12345', roleIds: [roleA.id] });
    const tokens = await login(request, { phone: s.phone, password: 'Roles@12345' });

    await api.patch(`/staff/${s.id}`, { roleIds: [roleB.id] });

    const sessions = await peek.sessions(s.id);
    expect(sessions.every((x) => x.revoked_at !== null)).toBe(true);
    expect(
      (await request.post('http://localhost:3000/api/auth/refresh', {
        data: { refreshToken: tokens.refreshToken },
      })).status(),
    ).toBe(401);
  });

  test('roleIds is a full replace, not an addition', async ({ api, data }) => {
    const roleA = await data.role(['member.list']);
    const roleB = await data.role(['plan.list']);
    const s = await data.staff({ password: 'Roles@12345', roleIds: [roleA.id] });

    await api.patch(`/staff/${s.id}`, { roleIds: [roleB.id] });
    const got = await api.json<StaffRow>(api.get(`/staff/${s.id}`));
    expect(got.roles.map((r) => r.id)).toEqual([roleB.id]);
  });

  test('refuses roles for someone with no account', async ({ api, data }) => {
    const s = await data.staff({ jobTitleCode: 'cleaner' });
    const role = await data.role(['member.list']);
    const res = await api.patch(`/staff/${s.id}`, { roleIds: [role.id] });
    expect(res.status()).toBe(400);
  });
});

test.describe('staff access', () => {
  test('grants a login to someone who had none', async ({ api, data, request }) => {
    const s = await data.staff({ jobTitleCode: 'receptionist' });
    expect((await api.json<StaffRow>(api.get(`/staff/${s.id}`))).hasAccount).toBe(false);

    const res = await api.post(`/staff/${s.id}/access`, { password: 'Granted@123' });
    expect(res.status()).toBe(201);

    expect((await api.json<StaffRow>(api.get(`/staff/${s.id}`))).hasAccount).toBe(true);
    const tokens = await login(request, { phone: s.phone, password: 'Granted@123' });
    expect(tokens.accessToken).toEqual(expect.any(String));
  });

  test('refuses to grant a second login', async ({ api, data }) => {
    const s = await data.staff({ password: 'Already@1234' });
    const res = await api.post(`/staff/${s.id}/access`, { password: 'Second@12345' });
    expect(res.status()).toBe(409);
    expect((await res.json()).message).toBe('This staff member already has system access');
  });

  test('cannot grant a login to a terminated employee, who is unreachable', async ({
    api,
    data,
  }) => {
    // The "Terminated staff cannot be given access" 400 is unreachable in
    // practice: terminating soft-deletes the person, so the lookup 404s first.
    const s = await data.staff({ jobTitleCode: 'receptionist' });
    await api.delete(`/staff/${s.id}`);
    const res = await api.post(`/staff/${s.id}/access`, { password: 'Toolate@1234' });
    expect(res.status()).toBe(404);
  });

  test('refuses to grant a login to a job title that cannot have one', async ({
    api,
    data,
  }) => {
    const s = await data.staff({ jobTitleCode: 'trainer' });
    const res = await api.post(`/staff/${s.id}/access`, { password: 'Trainer@123' });
    expect(res.status()).toBe(400);
  });

  test('disabling keeps the password, so re-enabling hands it straight back', async ({
    api,
    data,
    request,
  }) => {
    // This is the whole difference from revoking: a suspension you mean to lift.
    const s = await data.staff({ password: 'Keepme@12345' });
    const creds = { phone: s.phone, password: 'Keepme@12345' };

    expect((await api.patch(`/staff/${s.id}/access`, { status: 'disabled' })).status()).toBe(200);
    expect(
      (await request.post('http://localhost:3000/api/auth/login', { data: creds })).status(),
    ).toBe(401);

    expect((await api.patch(`/staff/${s.id}/access`, { status: 'active' })).status()).toBe(200);
    expect(
      (await request.post('http://localhost:3000/api/auth/login', { data: creds })).status(),
    ).toBe(200);
  });

  test('disabling revokes live sessions', async ({ api, data }) => {
    const s = await data.staff({ password: 'Killme@12345' });
    await api.patch(`/staff/${s.id}/access`, { status: 'disabled' });
    const sessions = await peek.sessions(s.id);
    expect(sessions.every((x) => x.revoked_at !== null)).toBe(true);
  });

  test('revoking deletes the account row outright', async ({ api, data, request }) => {
    // Revoked access should stop existing, not linger soft-deleted.
    const s = await data.staff({ password: 'Revoke@12345' });
    const res = await api.delete(`/staff/${s.id}/access`);
    expect(res.status()).toBe(200);

    expect(await peek.account(s.id)).toEqual([]);
    expect((await api.json<StaffRow>(api.get(`/staff/${s.id}`))).hasAccount).toBe(false);
    expect(
      (await request.post('http://localhost:3000/api/auth/login', {
        data: { phone: s.phone, password: 'Revoke@12345' },
      })).status(),
    ).toBe(401);
  });

  test('revoking cascades the role grants away', async ({ api, data }) => {
    const role = await data.role(['member.list']);
    const s = await data.staff({ password: 'Cascade@1234', roleIds: [role.id] });
    await api.delete(`/staff/${s.id}/access`);
    const got = await api.json<StaffRow>(api.get(`/staff/${s.id}`));
    expect(got.roles).toEqual([]);
  });

  test('revoking someone with no account is a 404', async ({ api, data }) => {
    const s = await data.staff({ jobTitleCode: 'cleaner' });
    const res = await api.delete(`/staff/${s.id}/access`);
    expect(res.status()).toBe(404);
    expect((await res.json()).message).toBe('This staff member has no system access');
  });

  test('disabling someone with no account is a 404', async ({ api, data }) => {
    const s = await data.staff({ jobTitleCode: 'cleaner' });
    expect((await api.patch(`/staff/${s.id}/access`, { status: 'disabled' })).status()).toBe(404);
  });

  test('rejects an account status outside the enum', async ({ api, data }) => {
    const s = await data.staff({ password: 'Enum@12345678' });
    expect((await api.patch(`/staff/${s.id}/access`, { status: 'locked' })).status()).toBe(400);
  });
});

test.describe('password reset', () => {
  test('replaces the password without knowing the old one', async ({
    api,
    data,
    request,
  }) => {
    const s = await data.staff({ password: 'Forgot@12345' });
    expect(
      (await api.patch(`/staff/${s.id}/password`, { newPassword: 'Reset@123456' })).status(),
    ).toBe(200);

    expect(
      (await request.post('http://localhost:3000/api/auth/login', {
        data: { phone: s.phone, password: 'Forgot@12345' },
      })).status(),
    ).toBe(401);
    expect(
      (await request.post('http://localhost:3000/api/auth/login', {
        data: { phone: s.phone, password: 'Reset@123456' },
      })).status(),
    ).toBe(200);
  });

  test('revokes every live session', async ({ api, data, request }) => {
    const s = await data.staff({ password: 'Forgot@12345' });
    const tokens = await login(request, { phone: s.phone, password: 'Forgot@12345' });
    await api.patch(`/staff/${s.id}/password`, { newPassword: 'Reset@123456' });
    expect(
      (await request.post('http://localhost:3000/api/auth/refresh', {
        data: { refreshToken: tokens.refreshToken },
      })).status(),
    ).toBe(401);
  });

  test('refuses on someone with no account, pointing at grant instead', async ({
    api,
    data,
  }) => {
    const s = await data.staff({ jobTitleCode: 'cleaner' });
    const res = await api.patch(`/staff/${s.id}/password`, { newPassword: 'Nope@1234567' });
    expect(res.status()).toBe(400);
    expect(String((await res.json()).message)).toContain('Grant access instead');
  });

  test('rejects a new password under eight characters', async ({ api, data }) => {
    const s = await data.staff({ password: 'Forgot@12345' });
    expect(
      (await api.patch(`/staff/${s.id}/password`, { newPassword: 'short1' })).status(),
    ).toBe(400);
  });
});

test.describe('termination', () => {
  test('soft-deletes the person, terminates the staff row and deletes the account', async ({
    api,
    data,
  }) => {
    const s = await data.staff({ password: 'Leaving@1234' });
    const res = await api.delete(`/staff/${s.id}`);
    expect(res.status()).toBe(200);
    expect(await res.json()).toMatchObject({ id: s.id });

    // All three effects have to be read from the database: the record is no
    // longer reachable through the API at all.
    expect((await api.get(`/staff/${s.id}`)).status()).toBe(404);

    const [person] = await peek.person(s.id);
    expect(person.deleted_at).not.toBeNull();

    const [row] = await peek.staff(s.id);
    expect(row.employment_status).toBe('terminated');
    expect(row.terminated_on).not.toBeNull();

    expect(await peek.account(s.id)).toEqual([]);
  });

  test('frees the phone for reuse', async ({ api, data }) => {
    const s = await data.staff({ password: 'Leaving@1234' });
    await api.delete(`/staff/${s.id}`);

    const branch = await data.mainBranch();
    const jt = await data.jobTitle('receptionist');
    const res = await api.post('/staff', {
      firstName: 'E2E',
      lastName: 'Successor',
      phone: s.phone,
      primaryBranchId: branch.id,
      jobTitleId: jt.id,
      hiredOn: gymToday(),
    });
    expect(res.status()).toBe(201);
    const created = await res.json();
    record('staff', created.personId);
    record('person', created.personId);
  });

  test('returns 404 for an unknown staff member', async ({ api }) => {
    const res = await api.get('/staff/00000000-0000-4000-8000-000000000000');
    expect(res.status()).toBe(404);
    expect((await res.json()).message).toBe('Staff member not found');
  });
});

test.describe('self-destruction guards', () => {
  /** Signs in as a throwaway staff member holding exactly `permissions`. */
  const actor = async (
    data: { role: (p: string[]) => Promise<{ id: string }>; staff: (o: Record<string, unknown>) => Promise<{ id: string; phone: string }> },
    request: Parameters<typeof login>[0],
    permissions: string[],
  ) => {
    const role = await data.role(permissions);
    const person = await data.staff({
      password: 'Guard@123456',
      roleIds: [role.id],
      dataScope: 'all',
    });
    const tokens = await login(request, { phone: person.phone, password: 'Guard@123456' });
    return { person, api: new ApiClass(request, tokens.accessToken) };
  };

  test('you cannot disable your own login', async ({ data, request }) => {
    const me = await actor(data, request, ['staff.revokeAccess', 'staff.read']);
    const res = await me.api.patch(`/staff/${me.person.id}/access`, { status: 'disabled' });
    expect(res.status()).toBe(403);
    expect((await res.json()).message).toBe('You cannot disable your own login');
  });

  test('you may re-enable your own login, which is harmless', async ({ data, request }) => {
    // The guard only fires on 'disabled' — enabling yourself changes nothing
    // you could not already do.
    const me = await actor(data, request, ['staff.revokeAccess', 'staff.read']);
    expect(
      (await me.api.patch(`/staff/${me.person.id}/access`, { status: 'active' })).status(),
    ).toBe(200);
  });

  test('you cannot revoke your own system access', async ({ data, request }) => {
    const me = await actor(data, request, ['staff.revokeAccess', 'staff.read']);
    const res = await me.api.delete(`/staff/${me.person.id}/access`);
    expect(res.status()).toBe(403);
    expect((await res.json()).message).toBe('You cannot revoke your own system access');
  });

  test('you cannot terminate yourself', async ({ data, request }) => {
    const me = await actor(data, request, ['staff.terminate', 'staff.read']);
    const res = await me.api.delete(`/staff/${me.person.id}`);
    expect(res.status()).toBe(403);
    expect((await res.json()).message).toBe('You cannot delete your own staff account');
  });

  test('you can still do all three to somebody else', async ({ data, request }) => {
    const me = await actor(data, request, [
      'staff.revokeAccess',
      'staff.terminate',
      'staff.read',
    ]);
    const colleague = await data.staff({ password: 'Other@123456' });
    expect(
      (await me.api.patch(`/staff/${colleague.id}/access`, { status: 'disabled' })).status(),
    ).toBe(200);
    expect((await me.api.delete(`/staff/${colleague.id}/access`)).status()).toBe(200);
    expect((await me.api.delete(`/staff/${colleague.id}`)).status()).toBe(200);
  });
});

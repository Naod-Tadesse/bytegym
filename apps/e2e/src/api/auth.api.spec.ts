import { test, expect } from '../support/fixtures';
import { API_URL, OWNER } from '../support/env';
import { login } from '../support/api-client';
import { peek } from '../support/db';
import { uniquePhone } from '../support/unique';

const loginUrl = `${API_URL}/api/auth/login`;
const refreshUrl = `${API_URL}/api/auth/refresh`;

test.describe('auth', () => {
  test('rejects a phone that does not match the 07/09 pattern', async ({ request }) => {
    const res = await request.post(loginUrl, {
      data: { phone: '12345', password: 'Admin@123' },
    });
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(String(body.message)).toContain('07 or 09');
  });

  test('rejects a missing password', async ({ request }) => {
    const res = await request.post(loginUrl, { data: { phone: OWNER.phone } });
    expect(res.status()).toBe(400);
  });

  test('rejects a password shorter than six characters', async ({ request }) => {
    const res = await request.post(loginUrl, {
      data: { phone: OWNER.phone, password: 'abc' },
    });
    expect(res.status()).toBe(400);
  });

  test('normalises a +251 phone before matching', async ({ request }) => {
    // +251911000000 -> 0911000000, the seeded owner. Proves the transform runs
    // before validation rather than after.
    const res = await request.post(loginUrl, {
      data: { phone: `+251${OWNER.phone.slice(1)}`, password: OWNER.password },
    });
    expect(res.status()).toBe(200);
  });

  test('rejects an unknown phone with "Invalid credentials"', async ({ request }) => {
    const res = await request.post(loginUrl, {
      data: { phone: uniquePhone(), password: 'Whatever@123' },
    });
    expect(res.status()).toBe(401);
    expect((await res.json()).message).toBe('Invalid credentials');
  });

  test('rejects a wrong password with the same message as an unknown phone', async ({
    request,
  }) => {
    const res = await request.post(loginUrl, {
      data: { phone: OWNER.phone, password: 'DefinitelyWrong@123' },
    });
    expect(res.status()).toBe(401);
    // Identical wording on purpose: the endpoint must not be an account oracle.
    expect((await res.json()).message).toBe('Invalid credentials');
  });

  test('rejects someone who has no account row', async ({ request, data }) => {
    // A cleaner is a full employee with no credential — there is no accounts
    // row to authenticate against.
    const cleaner = await data.staff({ jobTitleCode: 'cleaner' });
    const res = await request.post(loginUrl, {
      data: { phone: cleaner.phone, password: 'Anything@123' },
    });
    expect(res.status()).toBe(401);
    expect((await res.json()).message).toBe('Invalid credentials');
  });

  test('rejects a disabled account with a distinct message', async ({
    request,
    personas,
  }) => {
    const p = personas.personas.disabled;
    const res = await request.post(loginUrl, {
      data: { phone: p.phone, password: p.password },
    });
    expect(res.status()).toBe(401);
    expect((await res.json()).message).toBe('This account is not active');
  });

  test('rejects someone terminated through DELETE /staff/:id', async ({
    request,
    personas,
  }) => {
    // Terminating deletes the accounts row outright, so by the time login runs
    // there is no credential left to judge — the answer is the same
    // "Invalid credentials" an unknown phone gets, not the employment message.
    const p = personas.personas.terminated;
    const res = await request.post(loginUrl, {
      data: { phone: p.phone, password: p.password },
    });
    expect(res.status()).toBe(401);
    expect((await res.json()).message).toBe('Invalid credentials');
  });

  test('rejects a staff member marked terminated who still holds an account', async ({
    request,
    api,
    data,
  }) => {
    // The other route to terminated: PATCH the employment status and leave the
    // credential in place. That is the only way to reach this branch.
    const s = await data.staff({ password: 'StillHere@123' });
    expect(
      (await api.patch(`/staff/${s.id}`, { employmentStatus: 'terminated' })).status(),
    ).toBe(200);

    const res = await request.post(loginUrl, {
      data: { phone: s.phone, password: 'StillHere@123' },
    });
    expect(res.status()).toBe(401);
    expect((await res.json()).message).toBe('This account cannot sign in');
  });

  test('returns both tokens and answers 200, not 201', async ({ request }) => {
    const res = await request.post(loginUrl, { data: OWNER });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.accessToken).toEqual(expect.any(String));
    expect(body.refreshToken).toEqual(expect.any(String));
    expect(body.accessToken).not.toBe(body.refreshToken);
  });

  test('two logins in the same second produce different tokens', async ({ request }) => {
    // The refresh payload carries a jti for exactly this reason: without it the
    // two refresh tokens are byte-identical and collide on the unique index
    // over sessions.refresh_token_hash.
    const [a, b] = await Promise.all([
      request.post(loginUrl, { data: OWNER }).then((r) => r.json()),
      request.post(loginUrl, { data: OWNER }).then((r) => r.json()),
    ]);
    expect(a.refreshToken).not.toBe(b.refreshToken);
  });

  test('stamps lastLoginAt on the account', async ({ request, api, personas }) => {
    const before = await api.json<{ lastLoginAt: string | null }>(
      api.get(`/staff/${personas.personas.reception.personId}`),
    );
    await request.post(loginUrl, {
      data: {
        phone: personas.personas.reception.phone,
        password: personas.personas.reception.password,
      },
    });
    const after = await api.json<{ lastLoginAt: string | null }>(
      api.get(`/staff/${personas.personas.reception.personId}`),
    );
    expect(after.lastLoginAt).not.toBeNull();
    // Epoch 0 stands in for "never signed in", so the comparison holds either
    // way without branching inside the test.
    expect(Date.parse(after.lastLoginAt!)).toBeGreaterThanOrEqual(
      before.lastLoginAt ? Date.parse(before.lastLoginAt) : 0,
    );
  });

  test('silently strips an unknown property rather than rejecting it', async ({
    request,
  }) => {
    // whitelist: true means undecorated properties are removed, not refused.
    const res = await request.post(loginUrl, {
      data: { ...OWNER, isAdmin: true, role: 'superuser' },
    });
    expect(res.status()).toBe(200);
  });
});

test.describe('auth/me', () => {
  test('returns identity, roles, branch and live permissions', async ({ api }) => {
    const me = await api.json<Record<string, unknown>>(api.get('/auth/me'));
    expect(me).toMatchObject({
      phone: OWNER.phone,
      status: 'active',
      dataScope: 'all',
      employmentStatus: 'active',
      branchName: 'Main Branch',
    });
    expect(me.roles).toContain('Owner');
    expect(me.staffCode).toMatch(/^ST\d{5}$/);
    expect(Array.isArray(me.permissions)).toBe(true);
    expect(me.permissions as string[]).toContain('staff.list');
  });

  test('strips branch.* permissions for a branch-scoped caller', async ({ as }) => {
    // resolvePermissions() removes them at both the token and /auth/me, so the
    // guard 403s and the sidebar hides Branches without either knowing why.
    const manager = await as('manager');
    const me = await manager.json<{ permissions: string[]; dataScope: string }>(
      manager.get('/auth/me'),
    );
    expect(me.dataScope).toBe('branch');
    expect(me.permissions.filter((p) => p.startsWith('branch.'))).toEqual([]);
  });

  test('rejects a request with no token', async ({ request }) => {
    const res = await request.get(`${API_URL}/api/auth/me`);
    expect(res.status()).toBe(401);
  });

  test('rejects a malformed bearer token', async ({ request }) => {
    const res = await request.get(`${API_URL}/api/auth/me`, {
      headers: { Authorization: 'Bearer not.a.jwt' },
    });
    expect(res.status()).toBe(401);
  });

  test('rejects a token signed with the wrong secret', async ({ request }) => {
    const forged = [
      Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
      Buffer.from(JSON.stringify({ sub: 'x', permissions: ['staff.list'] })).toString(
        'base64url',
      ),
      'bogussignature',
    ].join('.');
    const res = await request.get(`${API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${forged}` },
    });
    expect(res.status()).toBe(401);
  });
});

test.describe('refresh', () => {
  test('rotates the refresh token and returns a new pair', async ({
    request,
    data,
  }) => {
    // Every session-revoking test owns its own staff member. Sharing a persona
    // here would mean one test's "revoke everything" races another's "this
    // session is still good".
    const p = await data.staff({ password: 'Rotate@12345' });
    const first = await login(request, { phone: p.phone, password: 'Rotate@12345' });
    const res = await request.post(refreshUrl, {
      data: { refreshToken: first.refreshToken },
    });
    expect(res.status()).toBe(200);
    const next = await res.json();
    expect(next.refreshToken).not.toBe(first.refreshToken);
    expect(next.accessToken).toEqual(expect.any(String));
  });

  test('replaying a rotated refresh token fails and revokes every session', async ({
    request,
    data,
  }) => {
    const p = await data.staff({ password: 'Replay@12345' });
    const creds = { phone: p.phone, password: 'Replay@12345' };
    const first = await login(request, creds);
    const second = await login(request, creds);

    // Rotate the first, then replay it. A replay means the token leaked, so
    // every session for that person dies — including the untouched second one.
    await request.post(refreshUrl, { data: { refreshToken: first.refreshToken } });
    const replay = await request.post(refreshUrl, {
      data: { refreshToken: first.refreshToken },
    });
    expect(replay.status()).toBe(401);

    const stillGood = await request.post(refreshUrl, {
      data: { refreshToken: second.refreshToken },
    });
    expect(stillGood.status()).toBe(401);

    const sessions = await peek.sessions(p.id);
    expect(sessions.length).toBeGreaterThan(0);
    expect(sessions.every((s) => s.revoked_at !== null)).toBe(true);
  });

  test('rejects a refresh token signed with the access secret', async ({
    request,
    personas,
  }) => {
    const p = personas.personas.reception;
    const { accessToken } = await login(request, {
      phone: p.phone,
      password: p.password,
    });
    const res = await request.post(refreshUrl, { data: { refreshToken: accessToken } });
    expect(res.status()).toBe(401);
  });

  test('rejects an empty refresh token with 400', async ({ request }) => {
    const res = await request.post(refreshUrl, { data: { refreshToken: '' } });
    expect(res.status()).toBe(400);
  });
});

test.describe('logout', () => {
  test('with a refresh token revokes only that device', async ({
    request,
    data,
  }) => {
    const p = await data.staff({ password: 'Logout@12345' });
    const creds = { phone: p.phone, password: 'Logout@12345' };
    const deviceA = await login(request, creds);
    const deviceB = await login(request, creds);

    const res = await request.post(`${API_URL}/api/auth/logout`, {
      headers: { Authorization: `Bearer ${deviceA.accessToken}` },
      data: { refreshToken: deviceA.refreshToken },
    });
    expect(res.status()).toBe(204);

    // Assert against the session rows rather than by trying to refresh A's
    // token: that attempt is indistinguishable from a replay and would revoke
    // B as a side effect — see the next test.
    const sessions = await peek.sessions(p.id);
    expect(sessions.filter((s) => s.revoked_at !== null).length).toBeGreaterThan(0);

    // B is untouched and can still rotate.
    expect(
      (await request.post(refreshUrl, { data: { refreshToken: deviceB.refreshToken } })).status(),
    ).toBe(200);
  });

  test('refreshing a logged-out token is treated as a replay and kills the rest', async ({
    request,
    data,
  }) => {
    // A logged-out session and a stolen-then-rotated one look identical from
    // the server's side: a good signature with no live session. The endpoint
    // cannot tell them apart, so it assumes theft and revokes everything —
    // logging out on one device and then retrying its token signs you out
    // everywhere.
    const p = await data.staff({ password: 'Replayed@12345' });
    const creds = { phone: p.phone, password: 'Replayed@12345' };
    const deviceA = await login(request, creds);
    const deviceB = await login(request, creds);

    await request.post(`${API_URL}/api/auth/logout`, {
      headers: { Authorization: `Bearer ${deviceA.accessToken}` },
      data: { refreshToken: deviceA.refreshToken },
    });

    expect(
      (await request.post(refreshUrl, { data: { refreshToken: deviceA.refreshToken } })).status(),
    ).toBe(401);

    expect(
      (await request.post(refreshUrl, { data: { refreshToken: deviceB.refreshToken } })).status(),
    ).toBe(401);
  });

  test('without a refresh token revokes every session', async ({
    request,
    data,
  }) => {
    const p = await data.staff({ password: 'LogoutAll@123' });
    const creds = { phone: p.phone, password: 'LogoutAll@123' };
    const deviceA = await login(request, creds);
    const deviceB = await login(request, creds);

    const res = await request.post(`${API_URL}/api/auth/logout`, {
      headers: { Authorization: `Bearer ${deviceA.accessToken}` },
      data: {},
    });
    expect(res.status()).toBe(204);

    for (const t of [deviceA.refreshToken, deviceB.refreshToken]) {
      expect((await request.post(refreshUrl, { data: { refreshToken: t } })).status()).toBe(
        401,
      );
    }
  });

  test('requires a token', async ({ request }) => {
    expect((await request.post(`${API_URL}/api/auth/logout`, { data: {} })).status()).toBe(
      401,
    );
  });
});

test.describe('change password', () => {
  test('rejects a wrong current password', async ({ request, data }) => {
    const s = await data.staff({ password: 'Original@123' });
    const tokens = await login(request, { phone: s.phone, password: 'Original@123' });
    const res = await request.patch(`${API_URL}/api/auth/change-password`, {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
      data: { currentPassword: 'NotIt@123', newPassword: 'Replacement@123' },
    });
    expect(res.status()).toBe(401);
    expect((await res.json()).message).toBe('Current password is incorrect');
  });

  test('rejects a new password under eight characters', async ({ request, data }) => {
    // currentPassword allows 6, newPassword demands 8 — the asymmetry is
    // deliberate, so an old short password can still be used to replace itself.
    const s = await data.staff({ password: 'Original@123' });
    const tokens = await login(request, { phone: s.phone, password: 'Original@123' });
    const res = await request.patch(`${API_URL}/api/auth/change-password`, {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
      data: { currentPassword: 'Original@123', newPassword: 'short1' },
    });
    expect(res.status()).toBe(400);
  });

  test('replaces the password and invalidates the old one', async ({ request, data }) => {
    const s = await data.staff({ password: 'Original@123' });
    const tokens = await login(request, { phone: s.phone, password: 'Original@123' });

    const res = await request.patch(`${API_URL}/api/auth/change-password`, {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
      data: { currentPassword: 'Original@123', newPassword: 'Replacement@123' },
    });
    expect(res.status()).toBe(204);

    expect(
      (await request.post(loginUrl, { data: { phone: s.phone, password: 'Original@123' } })).status(),
    ).toBe(401);
    expect(
      (await request.post(loginUrl, { data: { phone: s.phone, password: 'Replacement@123' } })).status(),
    ).toBe(200);
  });

  test('revokes every session, so the old refresh token dies', async ({
    request,
    data,
  }) => {
    const s = await data.staff({ password: 'Original@123' });
    const tokens = await login(request, { phone: s.phone, password: 'Original@123' });

    await request.patch(`${API_URL}/api/auth/change-password`, {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
      data: { currentPassword: 'Original@123', newPassword: 'Replacement@123' },
    });

    expect(
      (await request.post(refreshUrl, { data: { refreshToken: tokens.refreshToken } })).status(),
    ).toBe(401);
  });
});

test.describe('token lifetime', () => {
  test('a live access token survives session revocation until it expires', async ({
    request,
    api,
    data,
  }) => {
    // JwtStrategy never consults the sessions table, so revoking cannot reach a
    // token already issued. This is what makes "revoke the sessions in the same
    // transaction" a statement about the *refresh* token, and why a permission
    // change does not take effect until the next sign-in.
    const s = await data.staff({ password: 'Original@123' });
    const tokens = await login(request, { phone: s.phone, password: 'Original@123' });

    expect(
      (await request.get(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      })).status(),
    ).toBe(200);

    await api.patch(`/staff/${s.id}/access`, { status: 'disabled' });

    // The access token still authenticates...
    expect(
      (await request.get(`${API_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      })).status(),
    ).toBe(200);
    // ...but it can never be renewed, and a fresh sign-in is refused.
    expect(
      (await request.post(refreshUrl, { data: { refreshToken: tokens.refreshToken } })).status(),
    ).toBe(401);
    expect(
      (await request.post(loginUrl, { data: { phone: s.phone, password: 'Original@123' } })).status(),
    ).toBe(401);
  });

  test('/auth/me reflects a role change immediately, unlike the token', async ({
    api,
    request,
    data,
  }) => {
    const role = await data.role(['member.list']);
    const s = await data.staff({ password: 'Original@123', roleIds: [role.id] });
    const tokens = await login(request, { phone: s.phone, password: 'Original@123' });

    const before = await request.get(`${API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });
    expect((await before.json()).permissions).toContain('member.list');

    // Replace the role's permissions. The token keeps its baked-in array; /me
    // re-resolves from the database on every call.
    await api.put(`/roles/${role.id}/permissions`, {
      permissionIds: await data.permissionIds(['plan.list']),
    });

    const after = await request.get(`${API_URL}/api/auth/me`, {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
    });
    const body = await after.json();
    expect(body.permissions).toContain('plan.list');
    expect(body.permissions).not.toContain('member.list');
  });
});

test.describe('health', () => {
  test('answers without a token', async ({ request }) => {
    const res = await request.get(`${API_URL}/api/health`);
    expect(res.status()).toBe(200);
    expect(await res.json()).toMatchObject({ status: 'ok', database: 'up' });
  });
});

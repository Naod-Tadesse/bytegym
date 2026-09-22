import { test, expect } from '../support/fixtures';
import { Api, login } from '../support/api-client';

/**
 * Every route the `reception` persona does NOT hold the permission for.
 * Reception has member.list/read/create, plan.list, membership.list/sell,
 * payment.list/record, checkin.list/record and sms.list — and nothing else.
 */
const FORBIDDEN_FOR_RECEPTION: [string, 'get' | 'post' | 'patch' | 'put' | 'delete', string][] = [
  ['staff.list', 'get', '/staff'],
  ['staff.read', 'get', '/staff/00000000-0000-4000-8000-000000000000'],
  ['role.list', 'get', '/roles'],
  ['role.list', 'get', '/permissions'],
  ['branch.list', 'get', '/branches'],
  ['report.view', 'get', '/reports/dashboard'],
  ['sms.settings', 'get', '/sms/settings'],
  ['jobTitle.list', 'get', '/job-titles'],
];

test.describe('permission enforcement', () => {
  test('a narrow persona is refused on every route it lacks', async ({ as }) => {
    const reception = await as('reception');
    for (const [permission, method, path] of FORBIDDEN_FOR_RECEPTION) {
      const res = await reception[method](path);
      expect(res.status(), `${method.toUpperCase()} ${path}`).toBe(403);
      expect(String((await res.json()).message), `${path} should name ${permission}`).toContain(
        'Missing permission',
      );
    }
  });

  test('the 403 names the permission actually enforced', async ({ as }) => {
    const reception = await as('reception');
    const res = await reception.get('/staff');
    expect((await res.json()).message).toBe('Missing permission: staff.list');
  });

  test('an account with no roles at all is refused everywhere', async ({ as }) => {
    const nobody = await as('noaccess');
    for (const path of ['/members', '/staff', '/roles', '/branches', '/membership-plans']) {
      expect((await nobody.get(path)).status(), path).toBe(403);
    }
  });

  test('but an account with no roles can still read its own identity', async ({ as }) => {
    // /auth/me carries no @Permissions() — it is authenticated-only.
    const nobody = await as('noaccess');
    const res = await nobody.get('/auth/me');
    expect(res.status()).toBe(200);
    expect((await res.json()).permissions).toEqual([]);
  });

  test('holding one permission of a pair is not enough', async ({ data, request }) => {
    // @Permissions('a','b') requires ALL of them.
    const role = await data.role(['member.read']);
    const person = await data.staff({
      password: 'Partial@1234',
      roleIds: [role.id],
      dataScope: 'all',
    });
    const tokens = await login(request, { phone: person.phone, password: 'Partial@1234' });
    const partial = new Api(request, tokens.accessToken);

    expect((await partial.get('/members')).status()).toBe(403); // needs member.list
    expect((await partial.get('/members/00000000-0000-4000-8000-000000000000')).status()).toBe(
      404,
    ); // has member.read, so it gets past the guard
  });

  test('staff authorisation needs role.assign, not staff.update', async ({
    data,
    request,
  }) => {
    // Changing who someone is differs from changing what they may do.
    const role = await data.role(['staff.update', 'staff.read']);
    const actor = await data.staff({
      password: 'Updater@1234',
      roleIds: [role.id],
      dataScope: 'all',
    });
    const tokens = await login(request, { phone: actor.phone, password: 'Updater@1234' });
    const updater = new Api(request, tokens.accessToken);

    const target = await data.staff({ password: 'Target@12345' });

    expect((await updater.patch(`/staff/${target.id}`, { lastName: 'Allowed' })).status()).toBe(
      200,
    );
    const denied = await updater.patch(`/staff/${target.id}/authorization`, {
      dataScope: 'branch',
    });
    expect(denied.status()).toBe(403);
    expect((await denied.json()).message).toBe('Missing permission: role.assign');
  });

  test('deactivating a branch needs branch.update, since branch.delete does not exist', async ({
    data,
    request,
  }) => {
    const role = await data.role(['branch.list', 'branch.create']);
    const actor = await data.staff({
      password: 'Brancher@123',
      roleIds: [role.id],
      dataScope: 'all',
    });
    const tokens = await login(request, { phone: actor.phone, password: 'Brancher@123' });
    const brancher = new Api(request, tokens.accessToken);

    const branch = await data.branch();
    const res = await brancher.delete(`/branches/${branch.id}`);
    expect(res.status()).toBe(403);
    expect((await res.json()).message).toBe('Missing permission: branch.update');
  });

  test('a permission granted mid-session only takes effect at the next sign-in', async ({
    api,
    data,
    request,
  }) => {
    // The guard reads the array baked into the token; /auth/me re-resolves live.
    // That gap is exactly why every grant change revokes sessions.
    const role = await data.role(['member.list']);
    const person = await data.staff({
      password: 'Grower@12345',
      roleIds: [role.id],
      dataScope: 'all',
    });
    const first = await login(request, { phone: person.phone, password: 'Grower@12345' });
    const stale = new Api(request, first.accessToken);

    expect((await stale.get('/membership-plans')).status()).toBe(403);

    await api.put(`/roles/${role.id}/permissions`, {
      permissionIds: await data.permissionIds(['member.list', 'plan.list']),
    });

    // The old token still lacks it...
    expect((await stale.get('/membership-plans')).status()).toBe(403);
    // ...though /auth/me already reports it.
    expect((await stale.json<{ permissions: string[] }>(stale.get('/auth/me'))).permissions).toContain(
      'plan.list',
    );

    // A fresh sign-in mints a token that carries it.
    const second = await login(request, { phone: person.phone, password: 'Grower@12345' });
    const fresh = new Api(request, second.accessToken);
    expect((await fresh.get('/membership-plans')).status()).toBe(200);
  });
});

test.describe('the permission catalogue matches what is enforced', () => {
  test('every group in the catalogue is non-empty', async ({ api }) => {
    const perms = await api.json<{ name: string; group: string }[]>(api.get('/permissions'));
    const groups = new Set(perms.map((p) => p.group));
    expect(groups.size).toBeGreaterThan(1);
    for (const g of groups) {
      expect(perms.filter((p) => p.group === g).length).toBeGreaterThan(0);
    }
  });

  test('the owner role holds every permission in the catalogue', async ({ api }) => {
    // The seed re-links Owner to everything, so a newly added permission is
    // picked up without a migration.
    const all = (await api.json<{ name: string }[]>(api.get('/permissions'))).map((p) => p.name);
    const me = await api.json<{ permissions: string[] }>(api.get('/auth/me'));
    for (const name of all) {
      expect(me.permissions, `owner is missing ${name}`).toContain(name);
    }
  });
});

import { test, expect } from '../support/fixtures';
import type { Paginated } from '../support/api-client';
import { login } from '../support/api-client';
import { record } from '../support/manifest';
import { uniqueName } from '../support/unique';
import { peek } from '../support/db';

interface Role {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  deletedAt: string | null;
}
interface RoleDetail extends Role {
  permissions: { id: string; name: string }[];
}

test.describe('roles', () => {
  test('creates a role with no permissions at all', async ({ api, scope }) => {
    const name = uniqueName(scope, 'role');
    const role = await api.json<Role>(
      api.post('/roles', { name, description: 'Nothing yet.' }),
    );
    record('roles', role.id);
    expect(role).toMatchObject({ name, isActive: true, deletedAt: null });

    const detail = await api.json<RoleDetail>(api.get(`/roles/${role.id}`));
    expect(detail.permissions).toEqual([]);
  });

  test('rejects a duplicate name differing only in case', async ({ api, data }) => {
    const existing = await data.role();
    const res = await api.post('/roles', { name: existing.name.toLowerCase() });
    expect(res.status()).toBe(409);
    expect((await res.json()).message).toBe('A role with this name already exists');
  });

  test('rejects a name longer than 255 characters', async ({ api }) => {
    expect((await api.post('/roles', { name: 'x'.repeat(256) })).status()).toBe(400);
  });

  test('grants permissions and reports how many were added', async ({ api, data, scope }) => {
    const role = await api.json<Role>(api.post('/roles', { name: uniqueName(scope, 'role') }));
    record('roles', role.id);
    const ids = await data.permissionIds(['member.list', 'member.read']);

    const result = await api.json<{ added: number; removed: number }>(
      api.put(`/roles/${role.id}/permissions`, { permissionIds: ids }),
    );
    expect(result).toEqual({ added: 2, removed: 0 });

    const detail = await api.json<RoleDetail>(api.get(`/roles/${role.id}`));
    expect(detail.permissions.map((p) => p.name).sort()).toEqual([
      'member.list',
      'member.read',
    ]);
  });

  test('PUT replaces the set rather than merging into it', async ({ api, data }) => {
    const role = await data.role(['member.list', 'member.read', 'member.create']);
    const result = await api.json<{ added: number; removed: number }>(
      api.put(`/roles/${role.id}/permissions`, {
        permissionIds: await data.permissionIds(['plan.list']),
      }),
    );
    expect(result).toEqual({ added: 1, removed: 3 });

    const detail = await api.json<RoleDetail>(api.get(`/roles/${role.id}`));
    expect(detail.permissions.map((p) => p.name)).toEqual(['plan.list']);
  });

  test('re-sending the same set is a no-op', async ({ api, data }) => {
    // The backend diffs rather than deleting and re-inserting, so untouched
    // grants keep their created_at.
    const role = await data.role(['member.list']);
    const result = await api.json<{ added: number; removed: number }>(
      api.put(`/roles/${role.id}/permissions`, {
        permissionIds: await data.permissionIds(['member.list']),
      }),
    );
    expect(result).toEqual({ added: 0, removed: 0 });
  });

  test('an empty permission set revokes everything', async ({ api, data }) => {
    const role = await data.role(['member.list', 'plan.list']);
    const result = await api.json<{ added: number; removed: number }>(
      api.put(`/roles/${role.id}/permissions`, { permissionIds: [] }),
    );
    expect(result).toEqual({ added: 0, removed: 2 });
  });

  test('rejects an unknown permission id', async ({ api, data }) => {
    // KNOWN BUG — currently answers 500, not 400.
    //
    // A well-formed uuid that matches no permission reaches the insert and
    // trips the role_permissions -> permissions foreign key. pg-errors.ts
    // translates 23505 and 23P01 but not 23503, so the violation escapes as an
    // unhandled error. The fix is either to check the ids against the catalogue
    // before inserting, or to map 23503 alongside the other two.
    //
    // test.fail() keeps this documented and makes the suite shout the day it is
    // fixed, so the expectation gets corrected rather than silently drifting.
    test.fail();
    const role = await data.role();
    const res = await api.put(`/roles/${role.id}/permissions`, {
      permissionIds: ['00000000-0000-4000-8000-000000000000'],
    });
    expect(res.status()).toBe(400);
  });

  test('rejects a permission id that is not a uuid', async ({ api, data }) => {
    const role = await data.role();
    const res = await api.put(`/roles/${role.id}/permissions`, {
      permissionIds: ['not-a-uuid'],
    });
    expect(res.status()).toBe(400);
  });

  test('renames and describes a role', async ({ api, data, scope }) => {
    const role = await data.role();
    const name = uniqueName(scope, 'renamed');
    const updated = await api.json<Role>(
      api.patch(`/roles/${role.id}`, { name, description: 'Changed.' }),
    );
    expect(updated).toMatchObject({ name, description: 'Changed.' });
  });

  test('deactivating a role strips its permissions from the next token', async ({
    api,
    data,
    request,
  }) => {
    // resolvePermissions() ignores inactive and soft-deleted roles, so the
    // effect shows at the next sign-in — not on tokens already issued.
    const role = await data.role(['member.list']);
    const s = await data.staff({ password: 'Inactive@123', roleIds: [role.id] });

    const before = await login(request, { phone: s.phone, password: 'Inactive@123' });
    const beforeMe = await request.get('http://localhost:3000/api/auth/me', {
      headers: { Authorization: `Bearer ${before.accessToken}` },
    });
    expect((await beforeMe.json()).permissions).toContain('member.list');

    await api.patch(`/roles/${role.id}`, { isActive: false });

    const after = await login(request, { phone: s.phone, password: 'Inactive@123' });
    const afterMe = await request.get('http://localhost:3000/api/auth/me', {
      headers: { Authorization: `Bearer ${after.accessToken}` },
    });
    expect((await afterMe.json()).permissions).not.toContain('member.list');
  });

  test('soft-deletes a role and frees its name for reuse', async ({ api, data }) => {
    // roles_name_active_uniq is partial on deleted_at is null, so a deleted
    // role must not hold its name forever.
    const role = await data.role();
    const deleted = await api.json<Role>(api.delete(`/roles/${role.id}`));
    expect(deleted.deletedAt).not.toBeNull();

    const reused = await api.json<Role>(api.post('/roles', { name: role.name }));
    record('roles', reused.id);
    expect(reused.name).toBe(role.name);
  });

  test('a soft-deleted role disappears from the list', async ({ api, data }) => {
    const role = await data.role();
    await api.delete(`/roles/${role.id}`);
    const page = await api.json<Paginated<Role>>(api.get('/roles', { search: role.name }));
    expect(page.data.map((r) => r.id)).not.toContain(role.id);
  });

  test('deleting a role detaches it and revokes the holders sessions', async ({
    api,
    data,
    request,
  }) => {
    // Otherwise a live refresh token keeps minting access tokens carrying a
    // deleted role's permissions.
    const role = await data.role(['member.list']);
    const s = await data.staff({ password: 'Holder@12345', roleIds: [role.id] });
    const tokens = await login(request, { phone: s.phone, password: 'Holder@12345' });

    await api.delete(`/roles/${role.id}`);

    const sessions = await peek.sessions(s.id);
    expect(sessions.every((x) => x.revoked_at !== null)).toBe(true);
    expect(
      (await request.post('http://localhost:3000/api/auth/refresh', {
        data: { refreshToken: tokens.refreshToken },
      })).status(),
    ).toBe(401);

    const detail = await api.json<{ roles: { id: string }[] }>(api.get(`/staff/${s.id}`));
    expect(detail.roles.map((r) => r.id)).not.toContain(role.id);
  });

  test('returns 404 for an unknown role', async ({ api }) => {
    const res = await api.get('/roles/00000000-0000-4000-8000-000000000000');
    expect(res.status()).toBe(404);
    expect((await res.json()).message).toBe('Role not found');
  });
});

test.describe('permission catalogue', () => {
  test('returns a plain array, not a paginated envelope', async ({ api }) => {
    const body = await api.json<unknown>(api.get('/permissions'));
    expect(Array.isArray(body)).toBe(true);
  });

  test('every permission has a name, display name and group', async ({ api }) => {
    const perms = await api.json<{ name: string; displayName: string; group: string }[]>(
      api.get('/permissions'),
    );
    expect(perms.length).toBeGreaterThan(0);
    for (const p of perms) {
      expect(p.name).toMatch(/^[a-zA-Z]+\.[a-zA-Z]+$/);
      expect(p.displayName.length).toBeGreaterThan(0);
      expect(p.group.length).toBeGreaterThan(0);
    }
  });

  test('carries the permissions the guards actually enforce', async ({ api }) => {
    // The string in @Permissions() is the string in permissions.name — nothing
    // maps or namespaces them, so a typo is a permission that never matches.
    const names = (await api.json<{ name: string }[]>(api.get('/permissions'))).map(
      (p) => p.name,
    );
    for (const required of [
      'member.list',
      'staff.grantAccess',
      'staff.revokeAccess',
      'staff.resetPassword',
      'role.assign',
      'checkin.override',
      'payment.void',
      'membership.sell',
      'report.view',
    ]) {
      expect(names).toContain(required);
    }
  });

  test('has no branch.delete and no plan.delete', async ({ api }) => {
    // Deliberate gaps: deactivating a branch requires branch.update, and a plan
    // is retired rather than removed.
    const names = (await api.json<{ name: string }[]>(api.get('/permissions'))).map(
      (p) => p.name,
    );
    expect(names).not.toContain('branch.delete');
    expect(names).not.toContain('plan.delete');
  });

  test('names are unique', async ({ api }) => {
    const names = (await api.json<{ name: string }[]>(api.get('/permissions'))).map(
      (p) => p.name,
    );
    expect(new Set(names).size).toBe(names.length);
  });
});

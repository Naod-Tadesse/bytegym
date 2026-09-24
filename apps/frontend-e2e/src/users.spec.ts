import { test, expect } from './support/fixtures';
import { gotoApp } from './support/app';
import { storageStatePath } from './support/env';
import { login } from './support/api-client';
import {
  anyDialog,
  expectActionDisabled,
  expectRowVisible,
  field,
  rowAction,
  rowFor,
  search,
  tableReady,
} from './support/locators';

test.describe('the users screen', () => {
  test.use({ storageState: storageStatePath('owner') });

  test('lists people who can sign in', async ({ page, data }) => {
    const withLogin = await data.staff({ password: 'Listed@12345' });
    await gotoApp(page, '/users');
    await search(page, withLogin.lastName, '/api/staff');
    await expectRowVisible(page, withLogin.lastName);
  });

  test('omits an employee who has no login', async ({ page, data }) => {
    // Users is the roster of credentials, not of people.
    const cleaner = await data.staff({ jobTitleCode: 'cleaner' });
    await gotoApp(page, '/users');
    await search(page, cleaner.lastName, '/api/staff');
    await expect(rowFor(page, cleaner.lastName)).toHaveCount(0);
  });

  test('offers no create button, because users come from granting access', async ({
    page,
  }) => {
    await gotoApp(page, '/users');
    await tableReady(page);
    await expect(page.getByRole('button', { name: /New user/ })).toHaveCount(0);
  });

  test('shows "No roles" for an account with none', async ({ page, data }) => {
    const s = await data.staff({ password: 'Roleless@123' });
    await gotoApp(page, '/users');
    await search(page, s.lastName, '/api/staff');
    await expect(rowFor(page, s.lastName)).toContainText('No roles');
  });

  test('renders the documented columns', async ({ page }) => {
    await gotoApp(page, '/users');
    await tableReady(page);
    for (const header of ['Name', 'Roles', 'Login', 'Last sign-in']) {
      await expect(page.getByRole('columnheader', { name: header }), header).toBeVisible();
    }
  });
});

test.describe('changing access', () => {
  test.use({ storageState: storageStatePath('owner') });

  test('resets a password, and the old one stops working', async ({
    page,
    data,
    request,
  }) => {
    const s = await data.staff({ password: 'Original@123' });

    await gotoApp(page, '/users');
    await search(page, s.lastName, '/api/staff');
    await rowAction(rowFor(page, s.lastName), 'Reset password').click();

    const dialog = anyDialog(page);
    await expect(dialog).toContainText('Reset password');
    await field(page, 'New password').fill('Replaced@123');
    await field(page, 'Confirm password').fill('Replaced@123');
    await dialog.getByRole('button', { name: 'Reset password' }).click();
    await expect(dialog).toHaveCount(0);

    const old = await request.post('http://localhost:3000/api/auth/login', {
      data: { phone: s.phone, password: 'Original@123' },
    });
    expect(old.status()).toBe(401);

    const fresh = await login(request, { phone: s.phone, password: 'Replaced@123' });
    expect(fresh.accessToken).toEqual(expect.any(String));
  });

  test('disables a login and flips the badge', async ({ page, data, request }) => {
    const s = await data.staff({ password: 'Disable@1234' });

    await gotoApp(page, '/users');
    await search(page, s.lastName, '/api/staff');
    await expect(rowFor(page, s.lastName)).toContainText('Active');

    await rowAction(rowFor(page, s.lastName), 'Disable login').click();
    await anyDialog(page).getByRole('button', { name: 'Disable login' }).click();

    await expect(rowFor(page, s.lastName)).toContainText('Disabled');

    const attempt = await request.post('http://localhost:3000/api/auth/login', {
      data: { phone: s.phone, password: 'Disable@1234' },
    });
    expect(attempt.status()).toBe(401);
  });

  test('re-enabling hands back the password they already know', async ({
    page,
    data,
    api,
    request,
  }) => {
    // The whole point of disable over revoke: it is a suspension you mean to
    // lift, so the credential survives.
    const s = await data.staff({ password: 'Comeback@123' });
    await api.patch(`/staff/${s.id}/access`, { status: 'disabled' });

    await gotoApp(page, '/users');
    await search(page, s.lastName, '/api/staff');
    await expect(rowFor(page, s.lastName)).toContainText('Disabled');

    await rowAction(rowFor(page, s.lastName), 'Enable login').click();
    await anyDialog(page).getByRole('button', { name: 'Enable login' }).click();

    await expect(rowFor(page, s.lastName)).toContainText('Active');
    const tokens = await login(request, { phone: s.phone, password: 'Comeback@123' });
    expect(tokens.accessToken).toEqual(expect.any(String));
  });

  test('revoking removes them from Users but keeps them on the staff roster', async ({
    page,
    data,
  }) => {
    const s = await data.staff({ password: 'Revoked@1234' });

    await gotoApp(page, '/users');
    await search(page, s.lastName, '/api/staff');
    await rowAction(rowFor(page, s.lastName), 'Revoke access').click();
    await anyDialog(page).getByRole('button', { name: 'Revoke access' }).click();

    await expect(rowFor(page, s.lastName)).toHaveCount(0);

    await gotoApp(page, '/staff');
    await search(page, s.lastName, '/api/staff');
    await expectRowVisible(page, s.lastName);
  });

  test('replacing roles from Edit access signs the target out', async ({
    page,
    data,
    request,
  }) => {
    const role = await data.role(['member.list']);
    const s = await data.staff({ password: 'Regrant@123', roleIds: [role.id] });
    const tokens = await login(request, { phone: s.phone, password: 'Regrant@123' });

    await gotoApp(page, '/users');
    await search(page, s.lastName, '/api/staff');
    await rowAction(rowFor(page, s.lastName), 'Edit access').click();

    const dialog = anyDialog(page);
    await expect(dialog).toContainText('Edit access');
    await dialog.getByRole('button', { name: 'Save access' }).click();
    await expect(dialog).toHaveCount(0);

    const refresh = await request.post('http://localhost:3000/api/auth/refresh', {
      data: { refreshToken: tokens.refreshToken },
    });
    expect(refresh.status()).toBe(401);
  });

  test('you cannot change your own access', async ({ page }) => {
    await gotoApp(page, '/users');
    await search(page, 'Admin', '/api/staff');
    const row = rowFor(page, 'System Admin');
    await expectActionDisabled(row, 'Disable login');
    await expectActionDisabled(row, 'Revoke access');
  });
});

test.describe('users without permission', () => {
  test.use({ storageState: storageStatePath('reception') });

  test('the screen is unreachable', async ({ page }) => {
    await gotoApp(page, '/users');
    await expect(page).toHaveURL(/\/$/);
  });
});

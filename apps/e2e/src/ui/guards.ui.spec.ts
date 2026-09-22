import { test, expect } from '../support/fixtures';
import { gotoApp } from '../support/app';
import { storageStatePath } from '../support/env';

/**
 * Route guards and sidebar filtering are UI convenience, never security — the
 * API enforces the same permission. What these assert is that the app does not
 * offer a screen the API will refuse.
 */
const NAV = [
  'Dashboard',
  'Check-ins',
  'Attendance',
  'Members',
  'Payments',
  'Plans',
  'Staff',
  'Users',
  'Roles',
  'Branches',
  'SMS',
];

test.describe('the owner sees everything', () => {
  test.use({ storageState: storageStatePath('owner') });

  test('every nav item is present', async ({ page }) => {
    await gotoApp(page, '/');
    for (const label of NAV) {
      await expect(page.getByRole('link', { name: label }), label).toBeVisible();
    }
  });

  test('each nav item opens its screen', async ({ page }) => {
    await gotoApp(page, '/');
    for (const [label, path] of [
      ['Members', '/members'],
      ['Staff', '/staff'],
      ['Roles', '/roles'],
      ['Branches', '/branches'],
    ] as const) {
      await page.getByRole('link', { name: label }).click();
      await expect(page).toHaveURL(new RegExp(path));
    }
  });
});

test.describe('an account with no roles', () => {
  test.use({ storageState: storageStatePath('noaccess') });

  test('sees only the items that need no permission', async ({ page }) => {
    await gotoApp(page, '/');
    await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();

    for (const label of NAV.filter((n) => n !== 'Dashboard')) {
      await expect(page.getByRole('link', { name: label }), label).toHaveCount(0);
    }
  });

  test('is redirected away from every guarded route', async ({ page }) => {
    for (const path of ['/members', '/staff', '/roles', '/branches', '/payments']) {
      await gotoApp(page, path);
      await expect(page, `${path} should redirect`).toHaveURL(/\/$/);
    }
  });

  test('renders no content from the guarded route before redirecting', async ({ page }) => {
    await gotoApp(page, '/staff');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: 'Staff' })).toHaveCount(0);
  });

  test('still reaches the dashboard, without the figures', async ({ page }) => {
    await gotoApp(page, '/');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
  });
});

test.describe('a receptionist', () => {
  test.use({ storageState: storageStatePath('reception') });

  test('sees the desk and members but not staff administration', async ({ page }) => {
    await gotoApp(page, '/');
    for (const label of ['Members', 'Check-ins', 'Payments', 'Plans', 'SMS']) {
      await expect(page.getByRole('link', { name: label }), label).toBeVisible();
    }
    for (const label of ['Staff', 'Users', 'Roles', 'Branches']) {
      await expect(page.getByRole('link', { name: label }), label).toHaveCount(0);
    }
  });

  test('reaches the members list', async ({ page }) => {
    await gotoApp(page, '/members');
    await expect(page).toHaveURL(/\/members/);
    await expect(page.getByRole('heading', { name: 'Members' })).toBeVisible();
  });

  test('is redirected from roles and branches', async ({ page }) => {
    for (const path of ['/roles', '/branches', '/staff', '/users']) {
      await gotoApp(page, path);
      await expect(page, path).toHaveURL(/\/$/);
    }
  });

  test('a permitted deep link survives a full reload', async ({ page }) => {
    // The guard renders null on first paint while /auth/me is in flight; a
    // reload must not turn that into a redirect.
    await gotoApp(page, '/members');
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Members' })).toBeVisible();
    await expect(page).toHaveURL(/\/members/);
  });
});

test.describe('a branch-scoped manager', () => {
  test.use({ storageState: storageStatePath('manager') });

  test('has no Branches item, because branch.* is stripped at branch scope', async ({
    page,
  }) => {
    // The role still holds branch.list; resolvePermissions() removes it from
    // the token, so one "Manager" role works at either scope.
    await gotoApp(page, '/');
    await expect(page.getByRole('link', { name: 'Branches' })).toHaveCount(0);
  });

  test('is redirected away from the branches screen', async ({ page }) => {
    await gotoApp(page, '/branches');
    await expect(page).toHaveURL(/\/$/);
  });

  test('still reaches members and attendance', async ({ page }) => {
    await gotoApp(page, '/members');
    await expect(page.getByRole('heading', { name: 'Members' })).toBeVisible();

    await gotoApp(page, '/attendance');
    await expect(page.getByRole('heading', { name: 'Attendance' })).toBeVisible();
  });
});

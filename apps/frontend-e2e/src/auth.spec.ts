import { test, expect } from './support/fixtures';
import { readAuthStorage, signIn } from './support/app';
import { OWNER, WEB_URL } from './support/env';
import { toasts } from './support/locators';

/**
 * These run signed out on purpose — no storageState — because they are about
 * the login screen and the redirect rules around it.
 */
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('signed out', () => {
  test('redirects the root to the login screen', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/auth\/login$/);
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  });

  test('redirects a deep link to the login screen', async ({ page }) => {
    await page.goto('/members');
    await expect(page).toHaveURL(/\/auth\/login$/);
  });

  test('shows the sign-in form with both fields', async ({ page }) => {
    await page.goto('/auth/login');
    await expect(page.getByLabel('Phone number')).toBeVisible();
    await expect(page.getByLabel('Password', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  });
});

test.describe('client-side validation', () => {
  test('requires a phone number', async ({ page }) => {
    await page.goto('/auth/login');
    await page.getByLabel('Password', { exact: true }).fill('Admin@123');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText('Phone number is required')).toBeVisible();
  });

  test('requires a password', async ({ page }) => {
    await page.goto('/auth/login');
    await page.getByLabel('Phone number').fill(OWNER.phone);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText(/Password must be at least 6/)).toBeVisible();
  });

  test('rejects a phone that is not 07 or 09 followed by eight digits', async ({ page }) => {
    await page.goto('/auth/login');
    await page.getByLabel('Phone number').fill('0612345678');
    await page.getByLabel('Password', { exact: true }).fill('Admin@123');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText(/must start with 07 or 09/)).toBeVisible();
  });

  test('caps the phone field at ten characters', async ({ page }) => {
    await page.goto('/auth/login');
    const phone = page.getByLabel('Phone number');
    await phone.fill('09123456789999');
    await expect(phone).toHaveValue('0912345678');
  });

  test('never sends a request while the form is invalid', async ({ page }) => {
    await page.goto('/auth/login');
    let attempted = false;
    page.on('request', (r) => {
      if (r.url().includes('/api/auth/login')) attempted = true;
    });
    await page.getByLabel('Phone number').fill('123');
    await page.getByLabel('Password', { exact: true }).fill('Admin@123');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByText(/must start with 07 or 09/)).toBeVisible();
    expect(attempted).toBe(false);
  });
});

test.describe('server responses', () => {
  test('shows wrong credentials in an alert, and raises no toast', async ({ page }) => {
    // The axios interceptor deliberately suppresses toasts for /auth/login so
    // the message lands next to the form instead of floating away.
    await signIn(page, { phone: OWNER.phone, password: 'DefinitelyWrong@1' });
    await expect(page.getByRole('alert')).toHaveText('Invalid credentials');
    await expect(toasts(page).locator('[data-slot="toast-title"]')).toHaveCount(0);
  });

  test('explains a disabled account', async ({ page, personas }) => {
    const p = personas.personas.disabled;
    await signIn(page, { phone: p.phone, password: p.password });
    await expect(page.getByRole('alert')).toHaveText('This account is not active');
  });

  test('explains a terminated staff member as invalid credentials', async ({
    page,
    personas,
  }) => {
    // Terminating deletes the credential, so there is nothing left to describe.
    const p = personas.personas.terminated;
    await signIn(page, { phone: p.phone, password: p.password });
    await expect(page.getByRole('alert')).toHaveText('Invalid credentials');
  });

  test('stays on the login screen after a failure', async ({ page }) => {
    await signIn(page, { phone: OWNER.phone, password: 'DefinitelyWrong@1' });
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page).toHaveURL(/\/auth\/login$/);
  });
});

test.describe('the password field', () => {
  test('toggles between hidden and visible', async ({ page }) => {
    await page.goto('/auth/login');
    const password = page.getByLabel('Password', { exact: true });
    await password.fill('Admin@123');
    await expect(password).toHaveAttribute('type', 'password');

    await page.getByRole('button', { name: 'Show password' }).click();
    await expect(password).toHaveAttribute('type', 'text');

    await page.getByRole('button', { name: 'Hide password' }).click();
    await expect(password).toHaveAttribute('type', 'password');
  });
});

test.describe('a successful sign-in', () => {
  test('lands on the dashboard with the shell rendered', async ({ page }) => {
    await signIn(page, OWNER);
    await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`^${WEB_URL}/$`));
  });

  test('stores both tokens under bytegym-auth', async ({ page }) => {
    await signIn(page, OWNER);
    await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();

    const stored = await readAuthStorage(page);
    expect(stored?.accessToken).toEqual(expect.any(String));
    expect(stored?.refreshToken).toEqual(expect.any(String));
  });

  test('bounces a signed-in visitor away from the login screen', async ({ page }) => {
    await signIn(page, OWNER);
    await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();

    await page.goto('/auth/login');
    await expect(page).toHaveURL(new RegExp(`^${WEB_URL}/$`));
  });
});

test.describe('signing out', () => {
  test('clears the stored tokens and returns to the login screen', async ({ page }) => {
    await signIn(page, OWNER);
    await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();

    await page.getByRole('button', { name: 'Open user menu' }).click();
    await page.getByRole('menuitem', { name: 'Log out' }).click();

    await expect(page).toHaveURL(/\/auth\/login$/);
    // clearAuth() sets both tokens to null rather than removing the key, so the
    // persisted envelope survives with empty values.
    expect(await readAuthStorage(page)).toEqual({
      accessToken: null,
      refreshToken: null,
    });
  });
});

test.describe('bad stored state', () => {
  test('a corrupt bytegym-auth value falls back to the login screen', async ({ page }) => {
    await page.goto('/auth/login');
    await page.evaluate(() => localStorage.setItem('bytegym-auth', 'not json at all'));
    await page.goto('/');
    await expect(page).toHaveURL(/\/auth\/login$/);
  });

  test('a token the API rejects clears auth instead of rendering the shell', async ({
    page,
  }) => {
    // __root.tsx renders null and redirects when /auth/me errors — it must not
    // show a half-built shell to someone holding a dead token.
    await page.goto('/auth/login');
    await page.evaluate(() =>
      localStorage.setItem(
        'bytegym-auth',
        JSON.stringify({
          state: { accessToken: 'dead.token.value', refreshToken: 'dead.refresh' },
          version: 0,
        }),
      ),
    );
    await page.goto('/members');
    await expect(page).toHaveURL(/\/auth\/login$/);
    await expect(page.getByRole('link', { name: 'Members' })).toHaveCount(0);
  });
});

test.describe('the refresh interceptor', () => {
  test('a 401 on a data request recovers instead of bouncing to login', async ({
    page,
    personas,
  }) => {
    // A genuine expiry cannot be waited out (JWT_EXPIRATION is a day), so the
    // 401 is injected. What matters is that the client refreshes and replays
    // rather than throwing the user out mid-task.
    //
    // The exact number of refresh calls is deliberately not asserted: which
    // in-flight request receives the injected 401 is not controllable, and
    // `navigator.locks` already collapses concurrent refreshes into one.
    const p = personas.personas.reception;
    await signIn(page, { phone: p.phone, password: p.password });
    await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();

    let refreshCalls = 0;
    page.on('request', (r) => {
      if (r.url().includes('/api/auth/refresh')) refreshCalls += 1;
    });

    let firstMembersCall = true;
    await page.route('**/api/members**', async (route) => {
      if (firstMembersCall) {
        firstMembersCall = false;
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ statusCode: 401, message: 'Unauthorized' }),
        });
        return;
      }
      await route.continue();
    });

    await page.getByRole('link', { name: 'Members' }).click();

    // The replayed request succeeds, so the table renders and the user stays
    // put rather than being sent back to the login screen.
    await expect(page.getByRole('table')).toBeVisible();
    await expect(page).toHaveURL(/\/members/);
    expect(refreshCalls).toBeLessThanOrEqual(1);
  });
});

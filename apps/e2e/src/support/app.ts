import { expect, type Page, type Response } from '@playwright/test';

/**
 * Navigate and wait for the authenticated shell to actually exist.
 *
 * __root.tsx renders nothing but a <Spinner/> while GET /auth/me is in flight —
 * the sidebar, header and <Outlet/> are not in the DOM at all. A bare
 * page.goto() followed by a locator assertion therefore burns the full expect
 * timeout and then fails with "element not found", which points at the wrong
 * thing entirely.
 *
 * Returns the /auth/me response so callers testing the signed-out path can
 * branch on a 401 instead of waiting for a shell that will never mount.
 */
export async function gotoApp(page: Page, path: string): Promise<Response | null> {
  // Armed before navigating: /auth/me fires during page load, and a listener
  // attached afterwards can miss it.
  const mePromise = page
    .waitForResponse(
      (r) => r.url().includes('/api/auth/me') && r.request().method() === 'GET',
      { timeout: 20_000 },
    )
    .catch(() => null);

  await page.goto(path);
  const me = await mePromise;

  if (!me || me.status() === 401) return me;

  // 'Dashboard' has no requiredPermission in sidebar-data.ts, so this link
  // exists for every signed-in persona — including one with no roles at all.
  await expect(page.getByRole('link', { name: 'Dashboard' })).toBeVisible();
  return me;
}

/** Sign in through the form, for the specs that are about the form. */
export async function signIn(
  page: Page,
  creds: { phone: string; password: string },
): Promise<void> {
  await page.goto('/auth/login');
  await page.getByLabel('Phone number').fill(creds.phone);
  await page.getByLabel('Password', { exact: true }).fill(creds.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
}

/** What the app persists under `bytegym-auth`. */
export async function readAuthStorage(
  page: Page,
): Promise<{ accessToken: string | null; refreshToken: string | null } | null> {
  return page.evaluate(() => {
    const raw = localStorage.getItem('bytegym-auth');
    if (!raw) return null;
    try {
      return JSON.parse(raw).state ?? null;
    } catch {
      return null;
    }
  });
}

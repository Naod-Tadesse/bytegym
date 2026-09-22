import { test, expect } from '../support/fixtures';
import { gotoApp } from '../support/app';
import { storageStatePath } from '../support/env';
import { record } from '../support/manifest';

test.describe('the dashboard', () => {
  test.use({ storageState: storageStatePath('owner') });

  test('renders the four stat tiles', async ({ page }) => {
    await gotoApp(page, '/');
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    for (const tile of [
      'Active members',
      'Inactive members',
      'Check-ins today',
      'Taken today',
    ]) {
      await expect(page.getByText(tile, { exact: true }), tile).toBeVisible();
    }
  });

  test('explains what each figure counts', async ({ page }) => {
    await gotoApp(page, '/');
    await expect(page.getByText('A membership is running today')).toBeVisible();
    await expect(page.getByText('Members through the door so far')).toBeVisible();
  });

  test('renders the members-by-status breakdown', async ({ page }) => {
    await gotoApp(page, '/');
    await expect(page.getByText('Members by status')).toBeVisible();
  });

  test('check-ins today rises after someone is admitted', async ({ page, api, data }) => {
    // A delta, never an absolute: the dev database has its own history and
    // other workers are running at the same time.
    await gotoApp(page, '/');
    const tile = page
      .getByText('Check-ins today', { exact: true })
      .locator('..')
      .locator('..');
    const before = Number((await tile.innerText()).match(/\d+/)?.[0] ?? '0');

    const { member } = await data.activeMember();
    const res = await api.post('/check-ins', { memberId: member.id });
    record('check_ins', String((await res.json()).id));

    await page.reload();
    await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
    await expect
      .poll(async () => Number((await tile.innerText()).match(/\d+/)?.[0] ?? '0'))
      .toBeGreaterThan(before);
  });
});

test.describe('the dashboard without report.view', () => {
  test.use({ storageState: storageStatePath('reception') });

  test('shows the no-access panel instead of the figures', async ({ page }) => {
    await gotoApp(page, '/');
    await expect(page.getByText('No figures to show')).toBeVisible();
    await expect(page.getByText('Active members', { exact: true })).toHaveCount(0);
  });

  test('explains where to go instead', async ({ page }) => {
    await gotoApp(page, '/');
    await expect(
      page.getByText(/Everything you can reach is in the sidebar/),
    ).toBeVisible();
  });
});

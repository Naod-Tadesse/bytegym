import { test, expect } from '../support/fixtures';
import { gotoApp } from '../support/app';
import { storageStatePath } from '../support/env';
import type { Factories } from '../support/factories';
import {
  EMPTY_TABLE,
  expectToast,
  pagination,
  search,
  tableReady,
  tableSearch,
} from '../support/locators';

/**
 * Cross-cutting DataTable behaviour, exercised on /members because it is the
 * busiest list. Nothing here asserts an absolute row count — the suite shares
 * its database with real data.
 */
/** Eleven members guarantees a second page at the smallest page size of 10. */
const makePages = async (data: Factories) => {
  await Promise.all(Array.from({ length: 11 }, () => data.member()));
};

test.describe('the data table', () => {
  test.use({ storageState: storageStatePath('owner') });

  test('renders skeleton rows while loading', async ({ page }) => {
    // Skeletons live inside real <tr>s, so a row count is non-zero long before
    // any data arrives. Every count assertion has to wait them out first.
    await page.route('**/api/members**', async (route) => {
      await new Promise((r) => setTimeout(r, 1200));
      await route.continue();
    });
    await gotoApp(page, '/members');
    await expect(page.locator('tbody [data-slot="skeleton"]').first()).toBeVisible();
    await tableReady(page);
  });

  test('shows the hardcoded empty state when nothing matches', async ({ page, scope }) => {
    await gotoApp(page, '/members');
    await search(page, `${scope}-definitely-nobody`, '/api/members');
    await expect(page.getByText(EMPTY_TABLE)).toBeVisible();
  });

  test('shows a range and a page count', async ({ page }) => {
    await gotoApp(page, '/members');
    await tableReady(page);
    await expect(pagination.range(page)).toBeVisible();
    await expect(pagination.pageOf(page)).toBeVisible();
  });

  test('pages forward and back', async ({ page, data, scope }) => {
    // The dev database holds only a handful of members, so a second page has to
    // be created rather than assumed. Searching the worker's own scope keeps the
    // filtered set stable while other workers add their own records.
    await makePages(data);

    await gotoApp(page, '/members');
    await search(page, scope, '/api/members');

    const firstPage = await page.getByRole('row').allTextContents();
    await pagination.next(page).click();
    await tableReady(page);
    const secondPage = await page.getByRole('row').allTextContents();
    expect(secondPage).not.toEqual(firstPage);

    await pagination.prev(page).click();
    await tableReady(page);
    await expect(pagination.pageOf(page)).toContainText('Page 1');
  });

  test('disables Previous on the first page', async ({ page }) => {
    await gotoApp(page, '/members');
    await tableReady(page);
    await expect(pagination.prev(page)).toBeDisabled();
    await expect(pagination.first(page)).toBeDisabled();
  });

  test('jumps to the last page and disables Next there', async ({ page, data, scope }) => {
    await makePages(data);
    await gotoApp(page, '/members');
    await search(page, scope, '/api/members');
    await pagination.last(page).click();
    await tableReady(page);
    await expect(pagination.next(page)).toBeDisabled();
    await expect(pagination.last(page)).toBeDisabled();
  });

  test('changing the page size returns to page 1', async ({ page, data, scope }) => {
    await makePages(data);
    await gotoApp(page, '/members');
    await search(page, scope, '/api/members');
    await pagination.next(page).click();
    await tableReady(page);

    await pagination.rowsPerPage(page).click();
    await page.getByRole('option', { name: '20', exact: true }).click();
    await tableReady(page);

    await expect(pagination.pageOf(page)).toContainText('Page 1');
  });

  test('a new search returns to page 1', async ({ page, data, scope }) => {
    await makePages(data);
    await gotoApp(page, '/members');
    await search(page, scope, '/api/members');

    await pagination.next(page).click();
    await tableReady(page);
    await expect(pagination.pageOf(page)).toContainText('Page 2');

    await search(page, `${scope}-member-1`, '/api/members');
    await expect(pagination.pageOf(page)).toContainText('Page 1');
  });

  test('hides and restores a column from the View menu', async ({ page }) => {
    // 'View' and 'Toggle columns' are hardcoded English, not i18n keys. Exact
    // matching matters: every row also offers a "View details" action.
    await gotoApp(page, '/members');
    await tableReady(page);
    await expect(page.getByRole('columnheader', { name: 'Phone' })).toBeVisible();

    // The menu lists raw column ids, not the translated headers.
    await page.getByRole('button', { name: 'View', exact: true }).click();
    await page.getByRole('menuitemcheckbox', { name: /^phone$/i }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('columnheader', { name: 'Phone' })).toHaveCount(0);

    await page.getByRole('button', { name: 'View', exact: true }).click();
    await page.getByRole('menuitemcheckbox', { name: /^phone$/i }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('columnheader', { name: 'Phone' })).toBeVisible();
  });

  test('clearing the search restores the unfiltered list', async ({ page, scope }) => {
    await gotoApp(page, '/members');
    await search(page, `${scope}-nobody`, '/api/members');
    await expect(page.getByText(EMPTY_TABLE)).toBeVisible();

    await tableSearch(page).fill('');
    await tableReady(page);
    await expect(page.getByText(EMPTY_TABLE)).toHaveCount(0);
  });
});

test.describe('how the table reports failure', () => {
  test.use({ storageState: storageStatePath('owner') });

  test('a 500 raises an error toast', async ({ page }) => {
    await gotoApp(page, '/members');
    await tableReady(page);

    await page.route('**/api/members**', (route) =>
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ statusCode: 500, message: 'Internal server error' }),
      }),
    );
    await tableSearch(page).fill('trigger-a-failure');

    await expectToast(page, 'Internal server error');
  });

  test('a network failure names the connection', async ({ page }) => {
    await gotoApp(page, '/members');
    await tableReady(page);

    await page.route('**/api/members**', (route) => route.abort('failed'));
    await tableSearch(page).fill('trigger-a-network-failure');

    await expectToast(page, 'Network error. Please check your connection.');
  });

  test('a 403 surfaces the servers own message rather than a generic one', async ({
    page,
  }) => {
    await gotoApp(page, '/members');
    await tableReady(page);

    await page.route('**/api/members**', (route) =>
      route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ statusCode: 403, message: 'Missing permission: member.list' }),
      }),
    );
    await tableSearch(page).fill('trigger-a-forbidden');

    // The interceptor prefers the API's message when there is one, so the
    // permission the guard actually enforced reaches the user. 'Access
    // forbidden' is only the fallback for a 403 with no body.
    await expectToast(page, 'Missing permission: member.list');
  });
});

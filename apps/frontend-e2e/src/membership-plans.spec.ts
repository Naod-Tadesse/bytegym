import { test, expect } from './support/fixtures';
import { gotoApp } from './support/app';
import { storageStatePath } from './support/env';
import { uniqueName } from './support/unique';
import {
  confirmDialog,
  expectActionDisabled,
  expectRowVisible,
  expectToast,
  field,
  rowAction,
  rowFor,
  search,
  tableReady,
} from './support/locators';

test.describe('membership plans', () => {
  test.use({ storageState: storageStatePath('owner') });

  test('creates a plan and shows its duration and price', async ({ page, scope }) => {
    const name = uniqueName(scope, 'uiplan');

    await gotoApp(page, '/membership-plans');
    await page.getByRole('button', { name: 'New plan' }).click();
    await expect(page).toHaveURL(/\/membership-plans\/new/);

    await field(page, 'Plan name').fill(name);
    await field(page, 'Duration in days').fill('30');
    await field(page, 'Price (ETB)').fill('1500');
    await field(page, 'Registration fee (ETB)').fill('900');
    await page.getByRole('button', { name: 'Create' }).click();

    await expect(page).toHaveURL(/\/membership-plans\/?$/);
    await search(page, name, '/api/membership-plans');
    const row = rowFor(page, name);
    await expect(row).toContainText('30 days');
    await expect(row).toContainText('On sale');
  });

  test('pluralises a one-day plan correctly', async ({ page, scope }) => {
    const name = uniqueName(scope, 'uidaily');

    await gotoApp(page, '/membership-plans/new');
    await field(page, 'Plan name').fill(name);
    await field(page, 'Duration in days').fill('1');
    await field(page, 'Price (ETB)').fill('100');
    await page.getByRole('button', { name: 'Create' }).click();

    await search(page, name, '/api/membership-plans');
    await expect(rowFor(page, name)).toContainText('1 day');
    await expect(rowFor(page, name)).not.toContainText('1 days');
  });

  test('shows "None" when there is no registration fee', async ({ page, data }) => {
    const plan = await data.plan({ registrationFee: '0' });
    await gotoApp(page, '/membership-plans');
    await search(page, plan.name, '/api/membership-plans');
    await expect(rowFor(page, plan.name)).toContainText('None');
  });

  test('surfaces a duplicate plan name as an error toast', async ({ page, data }) => {
    const existing = await data.plan();

    await gotoApp(page, '/membership-plans/new');
    await field(page, 'Plan name').fill(existing.name);
    await field(page, 'Duration in days').fill('30');
    await field(page, 'Price (ETB)').fill('1000');
    await page.getByRole('button', { name: 'Create' }).click();

    await expectToast(page, /Conflict|already exists/);
  });

  test('retires a plan and flips the badge', async ({ page, data }) => {
    const plan = await data.plan();

    await gotoApp(page, '/membership-plans');
    await search(page, plan.name, '/api/membership-plans');
    await expect(rowFor(page, plan.name)).toContainText('On sale');

    await rowAction(rowFor(page, plan.name), 'Retire').click();
    const dialog = confirmDialog(page);
    await expect(dialog).toContainText('Retire this plan?');
    await dialog.getByRole('button', { name: 'Retire' }).click();

    await expect(rowFor(page, plan.name)).toContainText('Retired');
  });

  test('the retire action is disabled once the plan is retired', async ({ page, data }) => {
    const plan = await data.plan({ isActive: false });
    await gotoApp(page, '/membership-plans');
    await search(page, plan.name, '/api/membership-plans');
    await expectActionDisabled(rowFor(page, plan.name), 'Retire');
  });

  test('a retired plan is put back on sale from the edit page', async ({ page, data }) => {
    const plan = await data.plan({ isActive: false });

    await gotoApp(page, '/membership-plans');
    await search(page, plan.name, '/api/membership-plans');
    await rowAction(rowFor(page, plan.name), 'Edit').click();
    await expect(page).toHaveURL(/\/membership-plans\/.+\/edit/);

    await page.getByRole('switch', { name: /On sale/ }).click();
    await page.getByRole('button', { name: 'Save changes' }).click();

    await search(page, plan.name, '/api/membership-plans');
    await expect(rowFor(page, plan.name)).toContainText('On sale');
  });

  test('a retired plan stays in the list', async ({ page, data }) => {
    const plan = await data.plan({ isActive: false });
    await gotoApp(page, '/membership-plans');
    await search(page, plan.name, '/api/membership-plans');
    await expectRowVisible(page, plan.name);
  });

  test('renders the documented columns', async ({ page }) => {
    await gotoApp(page, '/membership-plans');
    await tableReady(page);
    for (const header of ['Plan', 'Duration', 'Price', 'Registration', 'Status']) {
      await expect(page.getByRole('columnheader', { name: header }), header).toBeVisible();
    }
  });
});

test.describe('plans for a reader without plan.update', () => {
  test.use({ storageState: storageStatePath('reception') });

  test('the whole actions cell is empty, and there is no create button', async ({
    page,
    data,
  }) => {
    // Reception holds plan.list but neither plan.create nor plan.update, so the
    // row offers nothing and RowActions renders null rather than an empty menu.
    const plan = await data.plan();
    await gotoApp(page, '/membership-plans');
    await search(page, plan.name, '/api/membership-plans');

    const row = rowFor(page, plan.name);
    await expect(row.getByRole('button', { name: 'Edit' })).toHaveCount(0);
    await expect(row.getByRole('button', { name: 'Retire' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'New plan' })).toHaveCount(0);
  });
});

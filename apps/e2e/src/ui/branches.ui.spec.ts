import { test, expect } from '../support/fixtures';
import { gotoApp } from '../support/app';
import { storageStatePath } from '../support/env';
import { uniqueName } from '../support/unique';
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
} from '../support/locators';

test.describe('branches', () => {
  test.use({ storageState: storageStatePath('owner') });

  test('creates a branch from the form and shows it in the table', async ({
    page,
    scope,
  }) => {
    const name = uniqueName(scope, 'uibranch');

    await gotoApp(page, '/branches');
    await page.getByRole('button', { name: 'New branch' }).click();
    await expect(page).toHaveURL(/\/branches\/new/);

    await field(page, 'Branch name').fill(name);
    await field(page, 'City').fill('Dire Dawa');
    await field(page, 'Phone').fill('0251110000');
    await page.getByRole('button', { name: 'Create' }).click();

    await expect(page).toHaveURL(/\/branches\/?$/);
    await search(page, name, '/api/branches');
    await expectRowVisible(page, name);
    await expect(rowFor(page, name)).toContainText('Dire Dawa');
  });

  test('shows a field error when the name is missing', async ({ page }) => {
    await gotoApp(page, '/branches/new');
    await page.getByRole('button', { name: 'Create' }).click();
    // Still on the form, and nothing was sent.
    await expect(page).toHaveURL(/\/branches\/new/);
    await expect(field(page, 'Branch name')).toHaveAttribute('aria-invalid', 'true');
  });

  test('surfaces a duplicate name as an error toast', async ({ page, data }) => {
    const existing = await data.branch();

    await gotoApp(page, '/branches/new');
    await field(page, 'Branch name').fill(existing.name);
    await page.getByRole('button', { name: 'Create' }).click();

    await expectToast(page, /Conflict|already exists/);
    await expect(page).toHaveURL(/\/branches\/new/);
  });

  test('edits a branch and the table reflects it', async ({ page, data }) => {
    const branch = await data.branch({ city: 'Adama' });

    await gotoApp(page, '/branches');
    await search(page, branch.name, '/api/branches');
    await rowAction(rowFor(page, branch.name), 'Edit').click();
    await expect(page).toHaveURL(/\/branches\/.+\/edit/);

    const city = field(page, 'City');
    await expect(city).toHaveValue('Adama');
    await city.fill('Mekelle');
    await page.getByRole('button', { name: 'Save changes' }).click();

    await expect(page).toHaveURL(/\/branches\/?$/);
    await search(page, branch.name, '/api/branches');
    await expect(rowFor(page, branch.name)).toContainText('Mekelle');
  });

  test('the edit form is populated on first render', async ({ page, data }) => {
    // Edit pages resolve the record in an outer component and pass it to an
    // inner one, so defaultValues are right immediately — no reset() flicker.
    const branch = await data.branch({ city: 'Hawassa' });
    await gotoApp(page, '/branches');
    await search(page, branch.name, '/api/branches');
    await rowAction(rowFor(page, branch.name), 'Edit').click();

    await expect(field(page, 'Branch name')).toHaveValue(branch.name);
    await expect(field(page, 'City')).toHaveValue('Hawassa');
  });

  test('the back button returns to the list rather than the previous page', async ({
    page,
  }) => {
    // Reached by deep link, so history has nowhere to go back to.
    await gotoApp(page, '/branches/new');
    await page.getByRole('button', { name: 'Go back' }).click();
    await expect(page).toHaveURL(/\/branches\/?$/);
  });

  test('deactivating asks for confirmation in an alert dialog', async ({ page, data }) => {
    const branch = await data.branch();

    await gotoApp(page, '/branches');
    await search(page, branch.name, '/api/branches');
    await rowAction(rowFor(page, branch.name), 'Deactivate').click();

    const dialog = confirmDialog(page);
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Deactivate branch?');
    await expect(dialog).toContainText(branch.name);
  });

  test('cancelling the confirmation leaves the branch active', async ({ page, data }) => {
    const branch = await data.branch();

    await gotoApp(page, '/branches');
    await search(page, branch.name, '/api/branches');
    await rowAction(rowFor(page, branch.name), 'Deactivate').click();
    await confirmDialog(page).getByRole('button', { name: 'Cancel' }).click();

    await expect(confirmDialog(page)).toHaveCount(0);
    await expect(rowFor(page, branch.name)).toContainText('Active');
  });

  test('confirming flips the badge to Inactive', async ({ page, data }) => {
    const branch = await data.branch();

    await gotoApp(page, '/branches');
    await search(page, branch.name, '/api/branches');
    await expect(rowFor(page, branch.name)).toContainText('Active');

    await rowAction(rowFor(page, branch.name), 'Deactivate').click();
    await confirmDialog(page).getByRole('button', { name: 'Deactivate' }).click();

    await expect(rowFor(page, branch.name)).toContainText('Inactive');
  });

  test('the deactivate action is disabled, with a reason, once inactive', async ({
    page,
    data,
  }) => {
    // Disabled rather than hidden: what you cannot do *yet* should say so,
    // while what you may never do is not advertised at all.
    const branch = await data.branch({ isActive: false });

    await gotoApp(page, '/branches');
    await search(page, branch.name, '/api/branches');
    await expectActionDisabled(rowFor(page, branch.name), 'Deactivate');
  });

  test('inactive branches remain listed', async ({ page, data }) => {
    const branch = await data.branch({ isActive: false });
    await gotoApp(page, '/branches');
    await search(page, branch.name, '/api/branches');
    await expectRowVisible(page, branch.name);
  });

  test('the table renders the documented columns', async ({ page }) => {
    await gotoApp(page, '/branches');
    await tableReady(page);
    for (const header of ['Name', 'City', 'Address', 'Phone', 'Status']) {
      await expect(
        page.getByRole('columnheader', { name: header }),
        header,
      ).toBeVisible();
    }
  });
});

test.describe('branches without permission', () => {
  test.use({ storageState: storageStatePath('reception') });

  test('the screen is not reachable at all', async ({ page }) => {
    await gotoApp(page, '/branches');
    await expect(page).toHaveURL(/\/$/);
  });
});

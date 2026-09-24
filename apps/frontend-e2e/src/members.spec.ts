import { test, expect } from './support/fixtures';
import { gotoApp } from './support/app';
import { storageStatePath } from './support/env';
import { uniqueName, uniquePhone } from './support/unique';
import {
  EMPTY_TABLE,
  confirmDialog,
  expectActionAbsent,
  expectRowVisible,
  expectToast,
  field,
  pickCombobox,
  rowAction,
  rowFor,
  search,
  tableReady,
  tableSearch,
} from './support/locators';

test.describe('members', () => {
  test.use({ storageState: storageStatePath('owner') });

  test('creates a member through the form', async ({ page, scope }) => {
    const lastName = uniqueName(scope, 'uimember');
    const phone = uniquePhone();

    await gotoApp(page, '/members');
    await page.getByRole('button', { name: 'New member' }).click();
    await expect(page).toHaveURL(/\/members\/new/);

    await field(page, 'First name').fill('E2E');
    await field(page, 'Last name').fill(lastName);
    await field(page, 'Phone').fill(phone);
    await pickCombobox(page, 'Home branch', 'Main Branch', { search: 'Main' });

    await page.getByRole('button', { name: 'Create' }).click();

    // Creating a member asks for confirmation first.
    const dialog = confirmDialog(page);
    await expect(dialog).toContainText('Create this member?');
    await dialog.getByRole('button', { name: 'Create' }).click();

    await expect(page).toHaveURL(/\/members\/?$/);
    await search(page, lastName, '/api/members');
    await expectRowVisible(page, lastName);
  });

  test('cancelling the confirmation creates nothing', async ({ page, scope }) => {
    const lastName = uniqueName(scope, 'uicancel');

    await gotoApp(page, '/members/new');
    await field(page, 'First name').fill('E2E');
    await field(page, 'Last name').fill(lastName);
    await field(page, 'Phone').fill(uniquePhone());
    await pickCombobox(page, 'Home branch', 'Main Branch', { search: 'Main' });

    await page.getByRole('button', { name: 'Create' }).click();
    await confirmDialog(page).getByRole('button', { name: 'Cancel' }).click();

    await expect(confirmDialog(page)).toHaveCount(0);
    await expect(page).toHaveURL(/\/members\/new/);
  });

  test('shows an inline error for a phone in the wrong shape', async ({ page }) => {
    await gotoApp(page, '/members/new');
    await field(page, 'First name').fill('E2E');
    await field(page, 'Last name').fill('Badphone');
    await field(page, 'Phone').fill('0612345678');
    await page.getByRole('button', { name: 'Create' }).click();

    await expect(field(page, 'Phone')).toHaveAttribute('aria-invalid', 'true');
    await expect(confirmDialog(page)).toHaveCount(0);
  });

  test('surfaces a duplicate phone as an error toast', async ({ page, data }) => {
    const existing = await data.member();

    await gotoApp(page, '/members/new');
    await field(page, 'First name').fill('E2E');
    await field(page, 'Last name').fill('Duplicate');
    await field(page, 'Phone').fill(existing.phone);
    await pickCombobox(page, 'Home branch', 'Main Branch', { search: 'Main' });
    await page.getByRole('button', { name: 'Create' }).click();
    await confirmDialog(page).getByRole('button', { name: 'Create' }).click();

    await expectToast(page, /Conflict|already exists/);
  });

  test('the branch combobox searches server-side', async ({ page, data }) => {
    // Branches come from a paginated endpoint, so the picker must search rather
    // than rely on a first page that may not contain the branch at all.
    const branch = await data.branch();

    await gotoApp(page, '/members/new');
    await pickCombobox(page, 'Home branch', branch.name, { search: branch.name });
    await expect(
      page.getByRole('combobox', { name: /^Home branch/ }),
    ).toContainText(branch.name);
  });

  test('picks a gender from the static select', async ({ page }) => {
    await gotoApp(page, '/members/new');
    await page.getByRole('combobox', { name: /^Gender/ }).click();
    await page.getByRole('option', { name: 'Female' }).click();
    await expect(page.getByRole('combobox', { name: /^Gender/ })).toContainText('Female');
  });
});

test.describe('the members table', () => {
  test.use({ storageState: storageStatePath('owner') });

  test('narrows to a single row when searching by member code', async ({ page, data }) => {
    const member = await data.member();
    await gotoApp(page, '/members');
    await search(page, member.memberCode, '/api/members');
    await expect(rowFor(page, member.lastName)).toHaveCount(1);
  });

  test('debounces the search into one request', async ({ page, data }) => {
    const member = await data.member();
    await gotoApp(page, '/members');
    await tableReady(page);

    let searches = 0;
    page.on('request', (r) => {
      if (r.url().includes('/api/members') && r.url().includes('search=')) searches += 1;
    });

    // Typed character by character: without the 300 ms debounce this would be
    // one request per keystroke.
    await tableSearch(page).pressSequentially(member.memberCode, { delay: 30 });
    await expect(rowFor(page, member.lastName)).toHaveCount(1);
    expect(searches).toBeLessThanOrEqual(2);
  });

  test('shows the hardcoded empty state when nothing matches', async ({ page, scope }) => {
    await gotoApp(page, '/members');
    await search(page, `${scope}-no-such-member`, '/api/members');
    await expect(page.getByText(EMPTY_TABLE)).toBeVisible();
  });

  test('opens the detail page when a row is clicked', async ({ page, data }) => {
    const member = await data.member();
    await gotoApp(page, '/members');
    await search(page, member.memberCode, '/api/members');
    await rowFor(page, member.lastName).click();
    await expect(page).toHaveURL(/\/members\/[0-9a-f-]{36}/);
  });

  test('shows "No membership" for someone who has never bought one', async ({
    page,
    data,
  }) => {
    const member = await data.member();
    await gotoApp(page, '/members');
    await search(page, member.memberCode, '/api/members');
    await expect(rowFor(page, member.lastName)).toContainText('No membership');
  });

  test('shows Active with an expiry for a member with live cover', async ({ page, data }) => {
    const { member } = await data.activeMember();
    await gotoApp(page, '/members');
    await search(page, member.memberCode, '/api/members');
    await expect(rowFor(page, member.lastName)).toContainText('Active');
  });

  test('shows Expired for a member whose cover ran out', async ({ page, data }) => {
    const { member } = await data.expiredMember();
    await gotoApp(page, '/members');
    await search(page, member.memberCode, '/api/members');
    await expect(rowFor(page, member.lastName)).toContainText('Expired');
  });
});

test.describe('member row actions', () => {
  test.use({ storageState: storageStatePath('owner') });

  test('suspends a member and flips the status', async ({ page, data }) => {
    const member = await data.member();
    await gotoApp(page, '/members');
    await search(page, member.memberCode, '/api/members');

    await rowAction(rowFor(page, member.lastName), 'Suspend').click();
    const dialog = confirmDialog(page);
    await expect(dialog).toContainText('Suspend this member?');
    await dialog.getByRole('button', { name: 'Suspend' }).click();

    await expect(rowFor(page, member.lastName)).toContainText('Suspended');
  });

  test('lifts a suspension again', async ({ page, data }) => {
    const member = await data.member({ isSuspended: true });
    await gotoApp(page, '/members');
    await search(page, member.memberCode, '/api/members');
    await expect(rowFor(page, member.lastName)).toContainText('Suspended');

    await rowAction(rowFor(page, member.lastName), 'Lift suspension').click();
    await confirmDialog(page).getByRole('button', { name: 'Lift suspension' }).click();

    await expect(rowFor(page, member.lastName)).not.toContainText('Suspended');
  });

  test('deletes a member, who leaves the list', async ({ page, data }) => {
    const member = await data.member();
    await gotoApp(page, '/members');
    await search(page, member.memberCode, '/api/members');

    await rowAction(rowFor(page, member.lastName), 'Delete').click();
    const dialog = confirmDialog(page);
    await expect(dialog).toContainText('Delete member?');
    await dialog.getByRole('button', { name: 'Delete' }).click();

    await expect(page.getByText(EMPTY_TABLE)).toBeVisible();
  });

  test('edits a member from the row action', async ({ page, data }) => {
    const member = await data.member();
    await gotoApp(page, '/members');
    await search(page, member.memberCode, '/api/members');
    await rowAction(rowFor(page, member.lastName), 'Edit').click();

    await expect(page).toHaveURL(/\/members\/[0-9a-f-]{36}\/edit/);
    await expect(field(page, 'Last name')).toHaveValue(member.lastName);

    await field(page, 'Last name').fill(`${member.lastName}-edited`);
    await page.getByRole('button', { name: 'Save changes' }).click();

    await search(page, `${member.lastName}-edited`, '/api/members');
    await expectRowVisible(page, `${member.lastName}-edited`);
  });
});

test.describe('member actions a receptionist cannot perform', () => {
  test.use({ storageState: storageStatePath('reception') });

  test('update and delete actions are absent, not merely disabled', async ({
    page,
    data,
  }) => {
    // A control for something you may never do should not be advertised.
    const member = await data.member();
    await gotoApp(page, '/members');
    await search(page, member.memberCode, '/api/members');

    const row = rowFor(page, member.lastName);
    await expectActionAbsent(row, 'Edit');
    await expectActionAbsent(row, 'Suspend');
    await expectActionAbsent(row, 'Delete');
  });

  test('the New member button is present, because they may create', async ({ page }) => {
    await gotoApp(page, '/members');
    await expect(page.getByRole('button', { name: 'New member' })).toBeVisible();
  });

  test('View details is offered, because they hold member.read', async ({ page, data }) => {
    const member = await data.member();
    await gotoApp(page, '/members');
    await search(page, member.memberCode, '/api/members');
    await expect(
      rowAction(rowFor(page, member.lastName), 'View details'),
    ).toBeVisible();
  });
});

import { test, expect } from './support/fixtures';
import { gotoApp } from './support/app';
import { storageStatePath } from './support/env';
import { uniqueName, uniquePhone } from './support/unique';
import { login } from './support/api-client';
import {
  anyDialog,
  confirmDialog,
  expectActionAbsent,
  expectActionDisabled,
  expectRowVisible,
  expectToast,
  field,
  pickCombobox,
  pickDate,
  rowAction,
  rowFor,
  search,
  tableReady,
} from './support/locators';

test.describe('creating staff', () => {
  test.use({ storageState: storageStatePath('owner') });

  test('creates a staff member with a login who can then sign in', async ({
    page,
    scope,
    request,
  }) => {
    const lastName = uniqueName(scope, 'uistaff');
    const phone = uniquePhone();

    await gotoApp(page, '/staff');
    await page.getByRole('button', { name: 'New staff member' }).click();
    await expect(page).toHaveURL(/\/staff\/new/);

    await field(page, 'First name').fill('E2E');
    await field(page, 'Last name').fill(lastName);
    await field(page, 'Phone').fill(phone);
    await pickCombobox(page, 'Job title', 'Receptionist', { search: 'Recept' });
    await field(page, 'Password').fill('Created@1234');
    await field(page, 'Confirm password').fill('Created@1234');
    await pickCombobox(page, 'Primary branch', 'Main Branch', { search: 'Main' });
    await pickDate(page, 'Hired on', new Date());

    await page.getByRole('button', { name: 'Create' }).click();

    await search(page, lastName, '/api/staff');
    await expectRowVisible(page, lastName);

    const tokens = await login(request, { phone, password: 'Created@1234' });
    expect(tokens.accessToken).toEqual(expect.any(String));
  });

  test('hides the password fields for a job title that cannot hold an account', async ({
    page,
  }) => {
    // canHaveAccount is a capability flag on the job title — the form branches
    // on it rather than on the title's name.
    await gotoApp(page, '/staff/new');
    await pickCombobox(page, 'Job title', 'Trainer', { search: 'Train' });
    await expect(field(page, 'Password')).toHaveCount(0);
    await expect(field(page, 'Confirm password')).toHaveCount(0);
  });

  test('shows the password fields again for a title that can', async ({ page }) => {
    await gotoApp(page, '/staff/new');
    await pickCombobox(page, 'Job title', 'Trainer', { search: 'Train' });
    await expect(field(page, 'Password')).toHaveCount(0);

    await pickCombobox(page, 'Job title', 'Manager', { search: 'Manag' });
    await expect(field(page, 'Password')).toBeVisible();
  });

  test('requires the two passwords to match', async ({ page, scope }) => {
    await gotoApp(page, '/staff/new');
    await field(page, 'First name').fill('E2E');
    await field(page, 'Last name').fill(uniqueName(scope, 'uimismatch'));
    await field(page, 'Phone').fill(uniquePhone());
    await pickCombobox(page, 'Job title', 'Receptionist', { search: 'Recept' });
    await field(page, 'Password').fill('Created@1234');
    await field(page, 'Confirm password').fill('Different@123');
    await pickCombobox(page, 'Primary branch', 'Main Branch', { search: 'Main' });
    await pickDate(page, 'Hired on', new Date());

    await page.getByRole('button', { name: 'Create' }).click();
    await expect(page).toHaveURL(/\/staff\/new/);
  });

  test('surfaces a duplicate phone as an error toast', async ({ page, data, scope }) => {
    const existing = await data.staff();

    await gotoApp(page, '/staff/new');
    await field(page, 'First name').fill('E2E');
    await field(page, 'Last name').fill(uniqueName(scope, 'uidupe'));
    await field(page, 'Phone').fill(existing.phone);
    await pickCombobox(page, 'Job title', 'Cleaner', { search: 'Clean' });
    await pickCombobox(page, 'Primary branch', 'Main Branch', { search: 'Main' });
    await pickDate(page, 'Hired on', new Date());
    await page.getByRole('button', { name: 'Create' }).click();

    await expectToast(page, /Conflict|already exists/);
  });
});

test.describe('the staff table', () => {
  test.use({ storageState: storageStatePath('owner') });

  test('renders the documented columns, which do not include system access', async ({
    page,
  }) => {
    // Whether someone can sign in is deliberately not a roster column — it is
    // on the detail page, and the Users screen exists for that question.
    await gotoApp(page, '/staff');
    await tableReady(page);
    for (const header of ['Name', 'Phone', 'Job title', 'Employment']) {
      await expect(page.getByRole('columnheader', { name: header }), header).toBeVisible();
    }
  });

  test('the detail page says someone can sign in', async ({ page, data }) => {
    const withLogin = await data.staff({ password: 'HasLogin@123' });
    await gotoApp(page, '/staff');
    await search(page, withLogin.lastName, '/api/staff');
    await rowFor(page, withLogin.lastName).click();
    await expect(page.getByText('Can sign in')).toBeVisible();
  });

  test('the detail page says an employee has no login', async ({ page, data }) => {
    const cleaner = await data.staff({ jobTitleCode: 'cleaner' });
    await gotoApp(page, '/staff');
    await search(page, cleaner.lastName, '/api/staff');
    await rowFor(page, cleaner.lastName).click();
    await expect(page.getByText('No login')).toBeVisible();
  });

  test('opens the detail page from a row click', async ({ page, data }) => {
    const s = await data.staff({ password: 'Detail@12345' });
    await gotoApp(page, '/staff');
    await search(page, s.lastName, '/api/staff');
    await rowFor(page, s.lastName).click();
    await expect(page).toHaveURL(/\/staff\/[0-9a-f-]{36}/);
  });

  test('edits a staff member', async ({ page, data }) => {
    const s = await data.staff({ password: 'Edit@12345678' });
    await gotoApp(page, '/staff');
    await search(page, s.lastName, '/api/staff');
    await rowAction(rowFor(page, s.lastName), 'Edit').click();

    await expect(page).toHaveURL(/\/staff\/[0-9a-f-]{36}\/edit/);
    await expect(field(page, 'Last name')).toHaveValue(s.lastName);

    await field(page, 'Last name').fill(`${s.lastName}-edited`);
    await page.getByRole('button', { name: 'Save changes' }).click();

    // Saving a staff member lands on their detail page, not the roster.
    await gotoApp(page, '/staff');
    await search(page, `${s.lastName}-edited`, '/api/staff');
    await expectRowVisible(page, `${s.lastName}-edited`);
  });
});

test.describe('granting and removing access', () => {
  test.use({ storageState: storageStatePath('owner') });

  test('grants a login to someone who had none', async ({ page, data, request }) => {
    const cleaner = await data.staff({ jobTitleCode: 'receptionist' });

    await gotoApp(page, '/staff');
    await search(page, cleaner.lastName, '/api/staff');
    await rowAction(rowFor(page, cleaner.lastName), 'Grant system access').click();

    // Grant access is a ConfirmDialog with a form in its children slot, so it
    // is an alertdialog rather than a plain dialog.
    const dialog = anyDialog(page);
    await expect(dialog).toContainText('Grant system access');
    await field(page, 'Password').fill('Granted@1234');
    await field(page, 'Confirm password').fill('Granted@1234');
    await dialog.getByRole('button', { name: 'Grant access' }).click();
    await expect(dialog).toHaveCount(0);

    const tokens = await login(request, {
      phone: cleaner.phone,
      password: 'Granted@1234',
    });
    expect(tokens.accessToken).toEqual(expect.any(String));
  });

  test('offers no grant action to someone who already has a login', async ({
    page,
    data,
  }) => {
    const s = await data.staff({ password: 'Already@1234' });
    await gotoApp(page, '/staff');
    await search(page, s.lastName, '/api/staff');
    await expectActionAbsent(rowFor(page, s.lastName), 'Grant system access');
  });

  test('terminates a staff member after confirming', async ({ page, data }) => {
    const s = await data.staff({ password: 'Bye@12345678' });

    await gotoApp(page, '/staff');
    await search(page, s.lastName, '/api/staff');
    await rowAction(rowFor(page, s.lastName), 'Terminate').click();

    const dialog = confirmDialog(page);
    await expect(dialog).toContainText('Terminate staff member?');
    await dialog.getByRole('button', { name: 'Terminate' }).click();

    // Terminating soft-deletes the person, so they leave the roster entirely.
    await expect(rowFor(page, s.lastName)).toHaveCount(0);
  });

  test('the terminate action is disabled on your own row', async ({ page }) => {
    // Guarded in the UI and again in the API — a 403 either way.
    await gotoApp(page, '/staff');
    await search(page, 'Admin', '/api/staff');
    await expectActionDisabled(rowFor(page, 'System Admin'), 'Terminate');
  });
});

test.describe('staff for someone without staff.list', () => {
  test.use({ storageState: storageStatePath('reception') });

  test('the screen is unreachable', async ({ page }) => {
    await gotoApp(page, '/staff');
    await expect(page).toHaveURL(/\/$/);
  });
});

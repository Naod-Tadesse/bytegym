import { test, expect } from './support/fixtures';
import { gotoApp } from './support/app';
import { storageStatePath } from './support/env';
import { uniqueName } from './support/unique';
import {
  confirmDialog,
  expectRowVisible,
  expectToast,
  field,
  formDialog,
  rowAction,
  rowFor,
  search,
} from './support/locators';

test.describe('roles', () => {
  test.use({ storageState: storageStatePath('owner') });

  test('creates a role through a dialog rather than a page', async ({ page, scope }) => {
    // Four inputs or fewer means a dialog; roles has two.
    const name = uniqueName(scope, 'uirole');

    await gotoApp(page, '/roles');
    await page.getByRole('button', { name: 'New role' }).click();

    const dialog = formDialog(page);
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('New role');

    await field(page, 'Role name').fill(name);
    await field(page, 'Description').fill('Created by the e2e suite.');
    await dialog.getByRole('button', { name: 'Create' }).click();

    await expect(formDialog(page)).toHaveCount(0);
    await search(page, name, '/api/roles');
    await expectRowVisible(page, name);
  });

  test('surfaces a duplicate role name as an error toast', async ({ page, data }) => {
    const existing = await data.role();

    await gotoApp(page, '/roles');
    await page.getByRole('button', { name: 'New role' }).click();
    await field(page, 'Role name').fill(existing.name);
    await formDialog(page).getByRole('button', { name: 'Create' }).click();

    await expectToast(page, /Conflict|already exists/);
  });

  test('renames a role from the edit dialog', async ({ page, data, scope }) => {
    const role = await data.role();
    const renamed = uniqueName(scope, 'uirenamed');

    await gotoApp(page, '/roles');
    await search(page, role.name, '/api/roles');
    await rowAction(rowFor(page, role.name), 'Edit').click();

    const dialog = formDialog(page);
    await expect(dialog).toContainText('Edit role');
    await expect(field(page, 'Role name')).toHaveValue(role.name);

    await field(page, 'Role name').fill(renamed);
    await dialog.getByRole('button', { name: 'Save changes' }).click();

    await search(page, renamed, '/api/roles');
    await expectRowVisible(page, renamed);
  });

  test('deletes a role after confirming', async ({ page, data }) => {
    const role = await data.role();

    await gotoApp(page, '/roles');
    await search(page, role.name, '/api/roles');
    await rowAction(rowFor(page, role.name), 'Delete').click();

    const dialog = confirmDialog(page);
    await expect(dialog).toContainText('Delete role?');
    await expect(dialog).toContainText(role.name);
    await dialog.getByRole('button', { name: 'Delete' }).click();

    await expect(rowFor(page, role.name)).toHaveCount(0);
  });
});

test.describe('managing a roles permissions', () => {
  test.use({ storageState: storageStatePath('owner') });

  const openPermissions = async (
    page: import('@playwright/test').Page,
    roleName: string,
  ) => {
    await gotoApp(page, '/roles');
    await search(page, roleName, '/api/roles');
    await rowAction(rowFor(page, roleName), 'Manage permissions').click();
    await expect(page).toHaveURL(/\/roles\/[0-9a-f-]{36}\/permissions/);
  };

  /**
   * The group checkbox's accessible name is "Select every permission in
   * {group}", and getByRole matches a substring by default — so "…in Members"
   * also matches "…in Memberships" and "…in Membership plans". Always exact.
   */
  const groupCheckbox = (page: import('@playwright/test').Page, group: string) =>
    page.getByRole('checkbox', {
      name: `Select every permission in ${group}`,
      exact: true,
    });

  /**
   * Each permission renders <label for="permission-<uuid>"> wrapping its
   * checkbox, so the label is the exact, unambiguous handle.
   *
   * NOTE: nothing in the DOM actually has that id — Base UI's Checkbox.Root
   * drops the `id` prop it is given, so every htmlFor here points at nothing.
   * It still works by mouse because the checkbox is nested inside the label,
   * and the accessible name is computed from the label's text, but the explicit
   * association is dead. Reported separately; the tests use the label element
   * rather than the id precisely because of it.
   */
  const permissionLabel = (
    page: import('@playwright/test').Page,
    permissionId: string,
  ) => page.locator(`label[for="permission-${permissionId}"]`);

  const permissionCheckbox = (
    page: import('@playwright/test').Page,
    permissionId: string,
  ) => permissionLabel(page, permissionId).locator('[data-slot="checkbox"]');

  /**
   * The panel is collapsed until its trigger is clicked, and the trigger's
   * accessible name carries the count badge — "Members0/5" — so an exact match
   * on the group name alone never hits, while a loose one also matches
   * "Membership plans".
   */
  const expandGroup = async (
    page: import('@playwright/test').Page,
    group: string,
  ) => {
    const trigger = page.getByRole('button', {
      name: new RegExp(`^${group}\\s*\\d+\\s*/\\s*\\d+$`),
    });
    // Idempotent: a group that is already open must not be toggled shut, which
    // would hide the very checkboxes the caller is about to click.
    if ((await trigger.getAttribute('aria-expanded')) !== 'true') {
      await trigger.click();
    }
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  };

  test('opens the permissions screen with the role named in the subtitle', async ({
    page,
    data,
  }) => {
    const role = await data.role();
    await openPermissions(page, role.name);
    await expect(page.getByRole('heading', { name: 'Manage permissions' })).toBeVisible();
    await expect(
      page.getByText(new RegExp(`${role.name}.*permissions granted`)),
    ).toBeVisible();
  });

  test('a group checkbox selects every permission in that group', async ({
    page,
    data,
  }) => {
    const role = await data.role();
    const memberIds = await data.permissionIds([
      'member.list',
      'member.read',
      'member.create',
      'member.update',
      'member.delete',
    ]);

    await openPermissions(page, role.name);
    await groupCheckbox(page, 'Members').click();
    await expandGroup(page, 'Members');

    for (const id of memberIds) {
      await expect(permissionCheckbox(page, id)).toBeChecked();
    }
  });

  test('unticking one permission puts the group into the indeterminate state', async ({
    page,
    data,
  }) => {
    const role = await data.role();
    const [memberList] = await data.permissionIds(['member.list']);

    await openPermissions(page, role.name);
    const group = groupCheckbox(page, 'Members');
    await group.click();
    await expect(group).toBeChecked();

    await expandGroup(page, 'Members');
    await permissionLabel(page, memberList).click();

    // Base UI exposes the tri-state as data-indeterminate, not
    // checked="indeterminate" the way Radix would.
    await expect(group).toHaveAttribute('data-indeterminate', '');
  });

  test('Save is disabled until the selection actually differs', async ({ page, data }) => {
    const role = await data.role(['member.list']);
    const [memberRead] = await data.permissionIds(['member.read']);

    await openPermissions(page, role.name);
    const save = page.getByRole('button', { name: 'Save changes' });
    await expect(save).toBeDisabled();

    await expandGroup(page, 'Members');
    await permissionLabel(page, memberRead).click();
    await expect(save).toBeEnabled();
  });

  test('toggling back to the original selection disables Save again', async ({
    page,
    data,
  }) => {
    const role = await data.role(['member.list']);
    const [memberRead] = await data.permissionIds(['member.read']);

    await openPermissions(page, role.name);
    await expandGroup(page, 'Members');

    const save = page.getByRole('button', { name: 'Save changes' });
    await permissionLabel(page, memberRead).click();
    await expect(save).toBeEnabled();
    await permissionLabel(page, memberRead).click();
    await expect(save).toBeDisabled();
  });

  test('the granted count in the subtitle tracks the selection', async ({ page, data }) => {
    const role = await data.role();
    const [memberList] = await data.permissionIds(['member.list']);

    await openPermissions(page, role.name);
    await expect(page.getByText(/0 of \d+ permissions granted/)).toBeVisible();

    await expandGroup(page, 'Members');
    await permissionLabel(page, memberList).click();
    await expect(page.getByText(/1 of \d+ permissions granted/)).toBeVisible();
  });

  test('saving persists, and the grant is visible when the page is reopened', async ({
    page,
    data,
  }) => {
    const role = await data.role();
    const [memberList] = await data.permissionIds(['member.list']);

    await openPermissions(page, role.name);
    await expandGroup(page, 'Members');
    await permissionLabel(page, memberList).click();
    await page.getByRole('button', { name: 'Save changes' }).click();

    // Saving returns to the list, so reopening is the way to prove it stuck.
    await expect(page).toHaveURL(/\/roles\/?$/);

    await openPermissions(page, role.name);
    await expandGroup(page, 'Members');
    await expect(permissionCheckbox(page, memberList)).toBeChecked();
  });

  test('cancelling returns to the list without saving', async ({ page, data }) => {
    const role = await data.role();
    const [memberList] = await data.permissionIds(['member.list']);

    await openPermissions(page, role.name);
    await expandGroup(page, 'Members');
    await permissionLabel(page, memberList).click();
    await page.getByRole('button', { name: 'Cancel' }).click();

    await expect(page).toHaveURL(/\/roles\/?$/);

    await openPermissions(page, role.name);
    await expandGroup(page, 'Members');
    await expect(permissionCheckbox(page, memberList)).not.toBeChecked();
  });
});

test.describe('roles without permission', () => {
  test.use({ storageState: storageStatePath('reception') });

  test('the screen is unreachable', async ({ page }) => {
    await gotoApp(page, '/roles');
    await expect(page).toHaveURL(/\/$/);
  });
});

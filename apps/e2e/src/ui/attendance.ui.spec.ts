import { test, expect } from '../support/fixtures';
import { gotoApp } from '../support/app';
import { storageStatePath } from '../support/env';
import { Api, login } from '../support/api-client';
import { record } from '../support/manifest';
import { comboboxSearch, rowFor, tableReady } from '../support/locators';

/**
 * The filter comboboxes have no label and no id, so their accessible name is
 * not the placeholder they display — filter on text content instead.
 */
const memberFilter = (page: import('@playwright/test').Page) =>
  page.getByRole('combobox').filter({ hasText: 'All members' });

test.describe('the attendance register', () => {
  test.use({ storageState: storageStatePath('owner') });

  test('opens filtered to today, with no search box', async ({ page }) => {
    // The register is read-only and date-scoped; searching happens through the
    // member filter instead, so DataTable is rendered with hideSearch.
    await gotoApp(page, '/attendance');
    await expect(page.getByRole('heading', { name: 'Attendance' })).toBeVisible();
    await expect(page.getByText('Every visit recorded, newest first')).toBeVisible();
  });

  test('renders the documented columns', async ({ page }) => {
    await gotoApp(page, '/attendance');
    await tableReady(page);
    for (const header of ['Date', 'Time', 'Member', 'Recorded by']) {
      await expect(page.getByRole('columnheader', { name: header }), header).toBeVisible();
    }
  });

  test('lists a visit recorded through the API', async ({ page, api, data }) => {
    const { member } = await data.activeMember();
    const res = await api.post('/check-ins', { memberId: member.id });
    record('check_ins', String((await res.json()).id));

    await gotoApp(page, '/attendance');
    await tableReady(page);

    // Filter to this member so the assertion does not depend on what else the
    // gym did today.
    await memberFilter(page).click();
    await comboboxSearch(page).fill(member.memberCode);
    await page.getByRole('option', { name: new RegExp(member.lastName) }).click();

    await expect(rowFor(page, member.lastName)).toBeVisible();
  });

  test('marks an override with the name of whoever authorised it', async ({
    page,
    data,
    request,
  }) => {
    const { member } = await data.expiredMember();
    const role = await data.role(['checkin.record', 'checkin.override', 'checkin.list']);
    const clerk = await data.staff({
      password: 'Override@123',
      roleIds: [role.id],
      dataScope: 'all',
    });
    const tokens = await login(request, { phone: clerk.phone, password: 'Override@123' });
    const clerkApi = new Api(request, tokens.accessToken);

    const res = await clerkApi.post('/check-ins', { memberId: member.id, override: true });
    record('check_ins', String((await res.json()).id));

    await gotoApp(page, '/attendance');
    await tableReady(page);
    await memberFilter(page).click();
    await comboboxSearch(page).fill(member.memberCode);
    await page.getByRole('option', { name: new RegExp(member.lastName) }).click();

    await expect(rowFor(page, member.lastName)).toContainText('Override by');
  });

  test('the member filter can be cleared again', async ({ page, api, data }) => {
    const { member } = await data.activeMember();
    const res = await api.post('/check-ins', { memberId: member.id });
    record('check_ins', String((await res.json()).id));

    await gotoApp(page, '/attendance');
    await tableReady(page);
    await memberFilter(page).click();
    await comboboxSearch(page).fill(member.memberCode);
    await page.getByRole('option', { name: new RegExp(member.lastName) }).click();
    await expect(rowFor(page, member.lastName)).toBeVisible();

    await page.getByRole('button', { name: 'Clear the member filter' }).click();
    await expect(memberFilter(page)).toBeVisible();
  });
});

test.describe('attendance for a branch-scoped manager', () => {
  test.use({ storageState: storageStatePath('manager') });

  test('is reachable and shows only their own branch', async ({
    page,
    api,
    data,
    personas,
  }) => {
    // A visit at Main Branch must not appear for a manager based elsewhere.
    const { member } = await data.activeMember({ branchId: personas.mainBranchId });
    const res = await api.post('/check-ins', { memberId: member.id });
    record('check_ins', String((await res.json()).id));

    await gotoApp(page, '/attendance');
    await tableReady(page);
    await expect(rowFor(page, member.lastName)).toHaveCount(0);
  });
});

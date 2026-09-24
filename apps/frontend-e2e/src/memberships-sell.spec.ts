import { test, expect } from './support/fixtures';
import { gotoApp } from './support/app';
import { storageStatePath } from './support/env';
import { anyDialog, pickCombobox, rowFor, search } from './support/locators';

test.describe('selling a membership', () => {
  test.use({ storageState: storageStatePath('owner') });

  test('reaches the sell page from the member record', async ({ page, data }) => {
    const member = await data.member();
    await data.plan({ durationDays: 30, price: '1000' });

    await gotoApp(page, '/members');
    await search(page, member.memberCode, '/api/members');
    await rowFor(page, member.lastName).click();

    await page.getByRole('button', { name: 'Sell membership' }).click();
    await expect(page).toHaveURL(/\/members\/[0-9a-f-]{36}\/sell/);
  });

  test('shows the price and the amount due once a plan is chosen', async ({
    page,
    data,
  }) => {
    const member = await data.member();
    const plan = await data.plan({ durationDays: 30, price: '1000', registrationFee: '900' });

    await gotoApp(page, `/members/${member.id}/sell`);
    await pickCombobox(page, 'Plan', plan.name, { search: plan.name });

    // A first sale carries the joining fee, so the total is price + fee.
    await expect(page.getByText('1,900.00 ETB').first()).toBeVisible();
  });

  test('sells a membership and it appears on the member record', async ({ page, data }) => {
    const member = await data.member();
    const plan = await data.plan({ durationDays: 30, price: '1000', registrationFee: '0' });

    await gotoApp(page, `/members/${member.id}/sell`);
    await pickCombobox(page, 'Plan', plan.name, { search: plan.name });
    await page.getByRole('button', { name: /^Sell/ }).click();

    const dialog = anyDialog(page);
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: /^Sell/ }).click();

    await expect(page).toHaveURL(/\/members\/[0-9a-f-]{36}$/);
    await expect(page.getByText(plan.name).first()).toBeVisible();
  });

  test('a complimentary membership owes nothing', async ({ page, data }) => {
    const member = await data.member();
    const plan = await data.plan({ durationDays: 30, price: '1000', registrationFee: '900' });

    await gotoApp(page, `/members/${member.id}/sell`);
    await pickCombobox(page, 'Plan', plan.name, { search: plan.name });
    await page.getByRole('switch', { name: /Complimentary/ }).click();

    await expect(page.getByText('0.00 ETB').first()).toBeVisible();
  });

  test('refuses to sell over a live membership', async ({ page, data }) => {
    // memberships_no_overlap is the backstop; the page says so before the user
    // gets that far.
    const { member } = await data.activeMember();

    await gotoApp(page, `/members/${member.id}/sell`);
    await expect(page.getByRole('button', { name: /^Sell/ })).toHaveCount(0);
  });

  test('the member record shows no membership before one is sold', async ({
    page,
    data,
  }) => {
    const member = await data.member();
    await gotoApp(page, `/members/${member.id}`);
    await expect(
      page.getByText('No membership yet. Sell one to let them through the door.'),
    ).toBeVisible();
  });
});

test.describe('selling without membership.sell', () => {
  test.use({ storageState: storageStatePath('manager') });

  test('the sell route is not reachable', async ({ page, data, personas }) => {
    // The manager persona holds membership.sell, so use a member outside their
    // branch: the record itself is out of scope.
    const member = await data.member({ branchId: personas.mainBranchId });
    await gotoApp(page, `/members/${member.id}/sell`);
    await expect(page.getByRole('button', { name: /^Sell/ })).toHaveCount(0);
  });
});

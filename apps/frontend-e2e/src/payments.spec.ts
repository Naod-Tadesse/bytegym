import { test, expect } from './support/fixtures';
import { gotoApp } from './support/app';
import { storageStatePath } from './support/env';
import type { Factories } from './support/factories';
import {
  anyDialog,
  expectActionAbsent,
  expectActionDisabled,
  field,
  rowFor,
  rowAction,
  search,
  tableReady,
} from './support/locators';

/** A member owing 1000 on a live membership. */
const owing = async (data: Factories) => {
  const member = await data.member();
  const plan = await data.plan({ price: '1000', registrationFee: '0' });
  const membership = await data.membership({ memberId: member.id, planId: plan.id });
  return { member, plan, membership };
};

test.describe('the payments register', () => {
  test.use({ storageState: storageStatePath('owner') });

  test('lists a payment with its method and reference', async ({ page, data }) => {
    const { member, membership } = await owing(data);
    await data.payment({
      memberId: member.id,
      membershipId: membership.id,
      amount: '250',
      method: 'telebirr',
      reference: 'TB-4242',
    });

    await gotoApp(page, '/payments');
    await search(page, member.memberCode, '/api/payments');
    const row = rowFor(page, member.lastName);
    await expect(row).toContainText('Telebirr');
    await expect(row).toContainText('250.00');
  });

  test('shows the received total in the header', async ({ page, data }) => {
    const { member, membership } = await owing(data);
    await data.payment({ memberId: member.id, membershipId: membership.id, amount: '250' });

    await gotoApp(page, '/payments');
    await search(page, member.memberCode, '/api/payments');
    await expect(page.getByText(/Received:/)).toBeVisible();
  });

  test('renders the documented columns', async ({ page }) => {
    await gotoApp(page, '/payments');
    await tableReady(page);
    // Reference and Branch are hidden by default — see the column-visibility
    // case above.
    for (const header of ['Date', 'Member', 'Method', 'Amount']) {
      await expect(page.getByRole('columnheader', { name: header }), header).toBeVisible();
    }
  });

  test('offers no create button — payments are taken against a membership', async ({
    page,
  }) => {
    await gotoApp(page, '/payments');
    await tableReady(page);
    await expect(page.getByRole('button', { name: 'Record payment' })).toHaveCount(0);
  });

  test('the method filter narrows the table and Reset clears it', async ({
    page,
    data,
  }) => {
    const { member, membership } = await owing(data);
    await data.payment({
      memberId: member.id,
      membershipId: membership.id,
      amount: '100',
      method: 'card',
    });

    await gotoApp(page, '/payments');
    await search(page, member.memberCode, '/api/payments');

    // 'Method' names two buttons: the faceted filter in the toolbar and the
    // sortable column header. The toolbar comes first in the DOM.
    await page.getByRole('button', { name: 'Method' }).first().click();
    await page.getByRole('option', { name: 'Card' }).click();
    await page.keyboard.press('Escape');

    await expect(rowFor(page, member.lastName)).toBeVisible();

    // 'Reset' is hardcoded English in data-table.tsx, not an i18n key.
    await expect(page.getByRole('button', { name: 'Reset' })).toBeVisible();
    await page.getByRole('button', { name: 'Reset' }).click();
    await expect(page.getByRole('button', { name: 'Reset' })).toHaveCount(0);
  });

  test('the date filter starts at "All dates"', async ({ page }) => {
    await gotoApp(page, '/payments');
    await tableReady(page);
    await expect(page.getByText('All dates')).toBeVisible();
  });
});

test.describe('voiding a payment', () => {
  test.use({ storageState: storageStatePath('owner') });

  test('requires a reason before it will void', async ({ page, data }) => {
    const { member, membership } = await owing(data);
    await data.payment({ memberId: member.id, membershipId: membership.id, amount: '250' });

    await gotoApp(page, '/payments');
    await search(page, member.memberCode, '/api/payments');
    await rowAction(rowFor(page, member.lastName), 'Void payment').click();

    const dialog = anyDialog(page);
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Void payment' }).click();
    // Still open: the reason is required.
    await expect(dialog).toBeVisible();
  });

  test('voids with a reason and marks the row', async ({ page, data }) => {
    const { member, membership } = await owing(data);
    await data.payment({ memberId: member.id, membershipId: membership.id, amount: '250' });

    await gotoApp(page, '/payments');
    await search(page, member.memberCode, '/api/payments');
    await rowAction(rowFor(page, member.lastName), 'Void payment').click();

    const dialog = anyDialog(page);
    await field(page, 'Why it is being voided').fill('Entered twice by mistake');
    await dialog.getByRole('button', { name: 'Void payment' }).click();
    await expect(dialog).toHaveCount(0);

    // Voided payments stay on the register — the record of the mistake is part
    // of the audit trail.
    await expect(rowFor(page, member.lastName)).toContainText('Voided');
  });

  test('the void action is disabled once already voided', async ({ page, data, api }) => {
    const { member, membership } = await owing(data);
    const payment = await data.payment({
      memberId: member.id,
      membershipId: membership.id,
      amount: '250',
    });
    await api.patch(`/payments/${payment.id}/void`, { reason: 'Already done' });

    await gotoApp(page, '/payments');
    await search(page, member.memberCode, '/api/payments');
    await expectActionDisabled(rowFor(page, member.lastName), 'Void payment');
  });
});

test.describe('payments for someone without payment.void', () => {
  test.use({ storageState: storageStatePath('reception') });

  test('the void action is absent, not merely disabled', async ({ page, data }) => {
    const { member, membership } = await owing(data);
    await data.payment({ memberId: member.id, membershipId: membership.id, amount: '250' });

    await gotoApp(page, '/payments');
    await search(page, member.memberCode, '/api/payments');
    await expectActionAbsent(rowFor(page, member.lastName), 'Void payment');
  });
});

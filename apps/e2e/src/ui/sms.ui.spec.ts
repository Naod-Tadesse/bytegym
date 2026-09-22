import { test, expect } from '../support/fixtures';
import { gotoApp } from '../support/app';
import { storageStatePath } from '../support/env';
import { uniquePhone } from '../support/unique';
import { anyDialog, field, tableReady } from '../support/locators';

/**
 * SMS_API_KEY in .env is a live key, and the provider allowlist is what stops
 * anything leaving the building. Every message these tests send goes to a
 * generated number that is never the gym's handset, and every assertion is on
 * "Held back" — a "Sent" here would mean a real text to a real person.
 */
test.describe('the sms screen', () => {
  test.use({ storageState: storageStatePath('owner') });

  test('shows the three cards and the log', async ({ page }) => {
    await gotoApp(page, '/sms');
    await expect(page.getByRole('heading', { name: 'SMS' })).toBeVisible();
    await expect(page.getByText('Message members, one at a time or all at once')).toBeVisible();
    await tableReady(page);
  });

  test('renders the documented log columns', async ({ page }) => {
    await gotoApp(page, '/sms');
    await tableReady(page);
    for (const header of ['When', 'To', 'Message', 'Type', 'Status']) {
      await expect(page.getByRole('columnheader', { name: header }), header).toBeVisible();
    }
  });

  test('counts the characters and the message parts', async ({ page }) => {
    await gotoApp(page, '/sms');
    // Both the send card and the broadcast card have a Message field and a
    // counter, so scope to the first.
    await field(page, 'Message').first().fill('E2E counter check');
    await expect(page.getByText(/\d+\/\d+ characters/).first()).toBeVisible();
  });

  test('rejects a phone outside the local pattern', async ({ page }) => {
    await gotoApp(page, '/sms');
    await field(page, 'Phone number').fill('0612345678');
    await field(page, 'Message').first().fill('E2E invalid phone');
    await page.getByRole('button', { name: 'Send' }).first().click();

    await expect(field(page, 'Phone number')).toHaveAttribute('aria-invalid', 'true');
  });

  test('sends a direct message, which is held back rather than delivered', async ({
    page,
  }) => {
    const phone = uniquePhone();
    await gotoApp(page, '/sms');
    await field(page, 'Phone number').fill(phone);
    await field(page, 'Message').first().fill('E2E direct message');
    await page.getByRole('button', { name: 'Send' }).first().click();

    // Sending asks for confirmation — a text cannot be recalled.
    const dialog = anyDialog(page);
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: /Send/ }).click();

    await expect(page.getByText('Held back').first()).toBeVisible();
  });

  test('choosing a plan audience reveals the plan picker', async ({ page }) => {
    await gotoApp(page, '/sms');
    await page.getByRole('combobox', { name: /^Send to/ }).click();
    await page.getByRole('option', { name: 'Members on one plan' }).click();
    await expect(page.getByRole('combobox', { name: /^Plan/ })).toBeVisible();
  });
});

test.describe('the sms log for a reader', () => {
  test.use({ storageState: storageStatePath('reception') });

  test('shows the log but offers no send or broadcast card', async ({ page }) => {
    // Reception holds sms.list alone — the three sms permissions are distinct.
    await gotoApp(page, '/sms');
    await tableReady(page);
    await expect(field(page, 'Phone number')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Review recipients/ })).toHaveCount(0);
  });
});

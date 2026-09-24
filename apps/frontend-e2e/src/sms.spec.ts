import { test, expect } from './support/fixtures';
import { gotoApp } from './support/app';
import { storageStatePath } from './support/env';
import { uniquePhone } from './support/unique';
import { anyDialog, field, tableReady } from './support/locators';

/**
 * Sending is the one thing in this suite that can cost money and reach a
 * stranger, so it is fenced off.
 *
 * There is no recipient allowlist any more: `SMS_PROVIDER` is the only thing
 * deciding whether a message leaves the building. Unset, `LogSmsSender` writes
 * to the log and sends nothing; set, every number typed in is texted for real —
 * including the random one a test would invent. So the one test that actually
 * submits the form skips itself whenever a provider is configured, and the rest
 * never touch the send button.
 */
const PROVIDER_CONFIGURED = Boolean(process.env.SMS_PROVIDER?.trim());
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

  test('asks for confirmation before sending, and cancels cleanly', async ({ page }) => {
    // Safe with any configuration: the dialog is dismissed, so nothing is sent.
    await gotoApp(page, '/sms');
    await field(page, 'Phone number').fill(uniquePhone());
    await field(page, 'Message').first().fill('E2E confirm then cancel');
    await page.getByRole('button', { name: 'Send' }).first().click();

    const dialog = anyDialog(page);
    await expect(dialog).toContainText('Send this message?');
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toHaveCount(0);
  });

  test('sends a direct message and writes it to the log', async ({ page }) => {
    // Skipped whenever a real provider is wired up. With SMS_PROVIDER set this
    // would text a randomly generated Ethiopian number belonging to a stranger,
    // and bill the gym for it.
    test.skip(
      PROVIDER_CONFIGURED,
      'SMS_PROVIDER is set — this would send a real text to a real number',
    );

    const phone = uniquePhone();
    await gotoApp(page, '/sms');
    await field(page, 'Phone number').fill(phone);
    await field(page, 'Message').first().fill('E2E direct message');
    await page.getByRole('button', { name: 'Send' }).first().click();

    // Sending asks for confirmation — a text cannot be recalled.
    const dialog = anyDialog(page);
    await expect(dialog).toContainText('Send this message?');
    await dialog.getByRole('button', { name: 'Send' }).click();
    await expect(dialog).toHaveCount(0);

    // LogSmsSender reports it as not delivered, which the log shows as Failed.
    // That is the honest outcome: nothing was delivered.
    await expect(page.getByText(phone).first()).toBeVisible();
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

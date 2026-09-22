import { test, expect } from '../support/fixtures';
import { gotoApp } from '../support/app';
import { storageStatePath } from '../support/env';

/**
 * The desk is not a table — it is a search box and a verdict. Every case here
 * is about the verdict the receptionist reads before deciding.
 */
const deskSearch = (page: import('@playwright/test').Page) =>
  page.getByLabel('Search by name, phone or member code…');

const findMember = async (
  page: import('@playwright/test').Page,
  code: string,
  lastName: string,
) => {
  await deskSearch(page).fill(code);
  await expect(page.getByText(lastName, { exact: false }).first()).toBeVisible();
};

test.describe('the check-in desk', () => {
  test.use({ storageState: storageStatePath('owner') });

  test('prompts before anything is typed', async ({ page }) => {
    await gotoApp(page, '/check-ins');
    // The desk's card title is a CardTitle div, not a heading — the only
    // heading on this screen is "Today's check-ins".
    await expect(page.getByText('Check in a member')).toBeVisible();
    await expect(page.getByText('Search for a member')).toBeVisible();
  });

  test('finds a member by their member code', async ({ page, data }) => {
    const { member } = await data.activeMember();
    await gotoApp(page, '/check-ins');
    await findMember(page, member.memberCode, member.lastName);
  });

  test('finds a member by phone number', async ({ page, data }) => {
    const { member } = await data.activeMember();
    await gotoApp(page, '/check-ins');
    await findMember(page, member.phone, member.lastName);
  });

  test('says so when nothing matches, quoting the search', async ({ page, scope }) => {
    await gotoApp(page, '/check-ins');
    const term = `${scope}-nobody`;
    await deskSearch(page).fill(term);
    // The message uses curly quotes — matching on a fragment avoids depending
    // on the exact typography.
    await expect(page.getByText(/No member matches/)).toBeVisible();
  });

  test('clears the search from the clear button', async ({ page, data }) => {
    const { member } = await data.activeMember();
    await gotoApp(page, '/check-ins');
    await deskSearch(page).fill(member.memberCode);
    await page.getByRole('button', { name: 'Clear the search' }).click();
    await expect(deskSearch(page)).toHaveValue('');
    await expect(page.getByText('Search for a member')).toBeVisible();
  });

  test('admits a member with live cover and confirms the time', async ({ page, data }) => {
    const { member } = await data.activeMember();
    await gotoApp(page, '/check-ins');
    await findMember(page, member.memberCode, member.lastName);

    await page.getByRole('button', { name: 'Check in' }).click();
    await expect(page.getByText(/Checked in at/)).toBeVisible();
  });

  test('a second scan the same day says already checked in', async ({ page, data }) => {
    // Members leave and come back; the desk must say so rather than error.
    const { member } = await data.activeMember();
    await gotoApp(page, '/check-ins');
    await findMember(page, member.memberCode, member.lastName);

    await page.getByRole('button', { name: 'Check in' }).click();
    await expect(page.getByText(/Checked in at/)).toBeVisible();

    // The card swaps the button for a badge once it has admitted someone, and
    // that outcome is local state — a genuine second scan means starting over.
    await page.reload();
    await expect(page.getByText('Check in a member')).toBeVisible();
    await findMember(page, member.memberCode, member.lastName);

    await page.getByRole('button', { name: 'Check in' }).click();
    await expect(page.getByText(/Already checked in at/)).toBeVisible();
  });

  test('an admitted member appears in todays list', async ({ page, data }) => {
    const { member } = await data.activeMember();
    await gotoApp(page, '/check-ins');
    await findMember(page, member.memberCode, member.lastName);
    await page.getByRole('button', { name: 'Check in' }).click();

    await expect(page.getByText(/Checked in at/)).toBeVisible();
    await expect(page.getByRole('heading', { name: /Today.s check-ins/ })).toBeVisible();
  });

  test('refuses a member who has never bought a membership', async ({ page, data }) => {
    const member = await data.member();
    await gotoApp(page, '/check-ins');
    await findMember(page, member.memberCode, member.lastName);

    await expect(page.getByText('They have never bought a membership')).toBeVisible();
    await expect(page.getByText('Sell them one to let them through the door.')).toBeVisible();
  });

  test('refuses an expired member and suggests a renewal', async ({ page, data }) => {
    const { member } = await data.expiredMember();
    await gotoApp(page, '/check-ins');
    await findMember(page, member.memberCode, member.lastName);

    await expect(page.getByText(/Their membership ran out on/)).toBeVisible();
    await expect(page.getByText('Sell them a renewal.')).toBeVisible();
  });

  test('refuses a suspended member and says an override will not help', async ({
    page,
    data,
    api,
  }) => {
    const { member } = await data.activeMember();
    await api.patch(`/members/${member.id}/suspension`, { isSuspended: true });

    await gotoApp(page, '/check-ins');
    await findMember(page, member.memberCode, member.lastName);

    // "Suspended" appears twice — the membership-status badge and the refusal
    // badge — so assert on the sentence that only the refusal carries.
    await expect(
      page.getByText('Fetch a manager. An override will not let them in.'),
    ).toBeVisible();
  });

  test('offers no override for a suspended member, even to someone who may override', async ({
    page,
    data,
    api,
  }) => {
    // Suspension is a decision a human made; money is not. The owner holds
    // checkin.override and still must not see the button here.
    const { member } = await data.activeMember();
    await api.patch(`/members/${member.id}/suspension`, { isSuspended: true });

    await gotoApp(page, '/check-ins');
    await findMember(page, member.memberCode, member.lastName);

    await expect(page.getByRole('button', { name: 'Override and check in' })).toHaveCount(0);
  });

  test('offers an override for an expired member', async ({ page, data }) => {
    const { member } = await data.expiredMember();
    await gotoApp(page, '/check-ins');
    await findMember(page, member.memberCode, member.lastName);

    await expect(
      page.getByRole('button', { name: 'Override and check in' }),
    ).toBeVisible();
  });

  test('an override admits the member', async ({ page, data }) => {
    const { member } = await data.expiredMember();
    await gotoApp(page, '/check-ins');
    await findMember(page, member.memberCode, member.lastName);

    await page.getByRole('button', { name: 'Override and check in' }).click();
    await expect(page.getByText(/Checked in at/)).toBeVisible();
  });

  test('offers the member record beside a refusal, so the fix is one click away', async ({
    page,
    data,
  }) => {
    // Only offered when there IS a refusal: an admitted member needs nothing.
    const member = await data.member();
    await gotoApp(page, '/check-ins');
    await findMember(page, member.memberCode, member.lastName);

    await page.getByRole('button', { name: 'Open member' }).click();
    await expect(page).toHaveURL(/\/members\/[0-9a-f-]{36}/);
  });

  test('offers no member link once someone is admitted', async ({ page, data }) => {
    const { member } = await data.activeMember();
    await gotoApp(page, '/check-ins');
    await findMember(page, member.memberCode, member.lastName);
    await expect(page.getByRole('button', { name: 'Open member' })).toHaveCount(0);
  });
});

test.describe('the desk without override permission', () => {
  test.use({ storageState: storageStatePath('reception') });

  test('offers a check-in but no override for an expired member', async ({ page, data }) => {
    const { member } = await data.expiredMember();
    await gotoApp(page, '/check-ins');
    await findMember(page, member.memberCode, member.lastName);

    await expect(page.getByText(/Their membership ran out on/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Override and check in' })).toHaveCount(0);
  });

  test('still admits a member with live cover', async ({ page, data }) => {
    const { member } = await data.activeMember();
    await gotoApp(page, '/check-ins');
    await findMember(page, member.memberCode, member.lastName);
    await page.getByRole('button', { name: 'Check in' }).click();
    await expect(page.getByText(/Checked in at/)).toBeVisible();
  });
});

test.describe('the desk without member.list', () => {
  test.use({ storageState: storageStatePath('noaccess') });

  test('is not reachable at all', async ({ page }) => {
    // checkin.list gates the route itself, so someone with no roles never gets
    // as far as the "You cannot search members" panel.
    await gotoApp(page, '/check-ins');
    await expect(page).toHaveURL(/\/$/);
  });
});

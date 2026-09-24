import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Every locator recipe lives here.
 *
 * The app has no data-testid attributes; it does have thorough a11y wiring
 * (aria-label on every row action, id === name === htmlFor on every field, a
 * real semantic <table>) plus data-slot on the shadcn primitives. Keeping the
 * recipes in one file means a future switch to test ids is a one-file change.
 */

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * A form field by its label.
 *
 * Required fields render `{label} <span>*</span>`, so the accessible name is
 * "First name *". Anchoring at the start matches both required and optional.
 */
export const field = (page: Page, label: string): Locator =>
  page.getByLabel(new RegExp(`^${escapeRe(label)}\\s*\\*?$`));

/**
 * DataTable renders `limit` skeleton <tr>s while loading, so a row count is
 * non-zero long before any data exists. Await this before counting anything.
 */
export const tableReady = async (page: Page): Promise<void> => {
  await expect(page.locator('tbody [data-slot="skeleton"]')).toHaveCount(0);
};

export const table = (page: Page): Locator => page.getByRole('table');

/** A row containing this text anywhere. */
export const rowFor = (page: Page, text: string): Locator =>
  table(page).getByRole('row').filter({ hasText: text });

export const expectRowVisible = async (page: Page, text: string) => {
  await tableReady(page);
  await expect(rowFor(page, text)).toBeVisible();
};

export const expectRowAbsent = async (page: Page, text: string) => {
  await tableReady(page);
  await expect(rowFor(page, text)).toHaveCount(0);
};

/** The table toolbar's search box — it has a placeholder and no label. */
export const tableSearch = (page: Page): Locator =>
  page.locator('input[placeholder]').first();

/**
 * Type into the table search and wait for the resulting request rather than the
 * 300 ms debounce. Never sleep for a debounce.
 */
export const search = async (page: Page, term: string, endpoint: string) => {
  // Wait for the list screen to actually be mounted first. Called straight
  // after a form submit, the table does not exist yet and `tableSearch` would
  // otherwise pick up the form's first input and fill that instead — the
  // request never fires and the failure points at the wrong thing entirely.
  await expect(table(page)).toBeVisible();

  const response = page.waitForResponse(
    (r) => r.url().includes(endpoint) && r.url().includes('search='),
  );
  await tableSearch(page).fill(term);
  await response;
  await tableReady(page);
};

/** ConfirmDialog is an AlertDialog; form dialogs are plain dialogs. */
export const confirmDialog = (page: Page): Locator =>
  page.getByRole('alertdialog');
export const formDialog = (page: Page): Locator => page.getByRole('dialog');

/**
 * Either kind. ConfirmDialog takes a `children` slot, so several screens put a
 * form inside an alertdialog — Grant access and Reset password among them — and
 * the caller should not have to know which it is.
 */
export const anyDialog = (page: Page): Locator =>
  page.locator('[role="dialog"], [role="alertdialog"]').last();

export const confirm = async (page: Page, label: string) => {
  await confirmDialog(page).getByRole('button', { name: label }).click();
};

/**
 * Toasts are Base UI's, not sonner: the viewport is a region named
 * "Notifications" and each toast is itself role="dialog". Always scope to the
 * region, or an unscoped getByRole('dialog') intermittently picks up a toast
 * instead of the form dialog under test. getByRole('status') never matches.
 */
export const toasts = (page: Page): Locator =>
  page.getByRole('region', { name: 'Notifications' });

export const expectToast = async (page: Page, text: string | RegExp) => {
  await expect(
    toasts(page).locator('[data-slot="toast-title"]').first(),
  ).toHaveText(text);
};

/**
 * DataCombobox: the trigger is a Button with role="combobox"; the popover is a
 * cmdk Command whose input carries data-slot="command-input". The input's only
 * other handle is a per-field placeholder ("Search branches…", with a
 * typographic ellipsis), so the data-slot is the stable way in.
 */
export const comboboxSearch = (page: Page): Locator =>
  // A previously-opened popover can stay mounted, so there may be more than one
  // command input in the DOM. Only one is ever on screen.
  page.locator('[data-slot="command-input"]:visible').last();

export const pickCombobox = async (
  page: Page,
  label: string,
  optionName: string,
  opts: { search?: string } = {},
) => {
  await page
    .getByRole('combobox', { name: new RegExp(`^${escapeRe(label)}`) })
    .click();
  if (opts.search) {
    await comboboxSearch(page).fill(opts.search);
  }
  await page.getByRole('option', { name: optionName }).click();
};

/** FormSelectField: Base UI Select, also exposed as role="combobox". */
export const pickSelect = async (
  page: Page,
  label: string,
  optionName: string,
) => {
  await page
    .getByRole('combobox', { name: new RegExp(`^${escapeRe(label)}`) })
    .click();
  await page.getByRole('option', { name: optionName }).click();
};

/**
 * FormDatePickerField is a Popover trigger wrapping a react-day-picker
 * calendar, not a text input — `fill()` on it fails outright. The day cells are
 * buttons labelled with the day of the month.
 */
export const pickDate = async (page: Page, label: string, date: Date) => {
  await page
    .getByRole('button', { name: new RegExp(`^${escapeRe(label)}`) })
    .click();
  // react-day-picker gives each day button a verbose accessible name
  // ("Monday, 21 September 2026"), so match the visible day number instead.
  await page
    .locator('[data-slot="popover-content"]:visible')
    .locator('button')
    .filter({ hasText: new RegExp(`^${date.getDate()}$`) })
    .first()
    .click();
};

export const pagination = {
  next: (page: Page) => page.getByRole('button', { name: 'Go to next page' }),
  prev: (page: Page) =>
    page.getByRole('button', { name: 'Go to previous page' }),
  first: (page: Page) => page.getByRole('button', { name: 'Go to first page' }),
  last: (page: Page) => page.getByRole('button', { name: 'Go to last page' }),
  /** "1-10 of 274" */
  range: (page: Page) => page.getByText(/^\d+-\d+ of \d+$/),
  /** "Page 1 of 28" */
  pageOf: (page: Page) => page.getByText(/^Page \d+ of \d+$/),
  /** The rows-per-page Select has no accessible name of its own. */
  rowsPerPage: (page: Page) =>
    page.getByText('Rows per page').locator('..').getByRole('combobox'),
};

/**
 * Row actions render as inline icon buttons whose only accessible name is the
 * action label. A disabled one uses aria-disabled rather than disabled, so that
 * the tooltip explaining why can still open — it is genuinely enabled as far as
 * the DOM is concerned.
 */
export const rowAction = (row: Locator, label: string): Locator =>
  row.getByRole('button', { name: label });

export const expectActionDisabled = async (row: Locator, label: string) => {
  await expect(rowAction(row, label)).toHaveAttribute('aria-disabled', 'true');
};

/** A control hidden by a missing permission is absent, not disabled. */
export const expectActionAbsent = async (row: Locator, label: string) => {
  await expect(rowAction(row, label)).toHaveCount(0);
};

/**
 * Hardcoded English in data-table.tsx, not an i18n key — matching it exactly is
 * safe, and it is deliberately not run through t().
 */
export const EMPTY_TABLE = 'No results.';

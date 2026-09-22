import playwright from 'eslint-plugin-playwright';
import baseConfig from '../../eslint.config.mjs';

export default [
  ...baseConfig,
  {
    ...playwright.configs['flat/recommended'],
    files: ['src/**/*.spec.ts', 'src/**/*.setup.ts'],
  },
  {
    files: ['src/**/*.spec.ts', 'src/**/*.setup.ts'],
    rules: {
      // waitForTimeout is how the debounce and toast races get "fixed" badly.
      // Wait on a response or assert web-first instead.
      'playwright/no-wait-for-timeout': 'error',
      'playwright/prefer-web-first-assertions': 'error',
      'playwright/no-conditional-in-test': 'warn',
      // Our assertions live in support/locators.ts, so the plugin has to be
      // told which wrappers count as an assertion.
      'playwright/expect-expect': [
        'error',
        {
          assertFunctionNames: [
            'expect',
            'expectToast',
            'expectRowVisible',
            'expectRowAbsent',
            'expectActionDisabled',
            'expectActionAbsent',
            'findMember',
            'makePages',
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.ts'],
    rules: {
      // Specs read far better with inline literals than with extracted consts.
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
  {
    files: ['src/setup/*.setup.ts'],
    rules: {
      // The setup project's block is `setup(...)`, not `test(...)`, which this
      // rule does not recognise — and it takes no options in this version.
      'playwright/no-standalone-expect': 'off',
    },
  },
  {
    files: ['src/support/fixtures.ts'],
    rules: {
      // `async ({}, use) => …` is Playwright's own signature for a fixture that
      // depends on nothing; the empty pattern is required, not an oversight.
      'no-empty-pattern': 'off',
    },
  },
];

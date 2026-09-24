import playwright from 'eslint-plugin-playwright';
import baseConfig from '../../eslint.config.mjs';

export default [
  playwright.configs['flat/recommended'],
  ...baseConfig,
  {
    files: ['**/*.ts', '**/*.js'],
    // Override or add rules here
    rules: {},
  },
  {
    files: ['src/**/*.spec.ts', 'src/**/*.setup.ts'],
    rules: {
      /**
       * Sleeping through a debounce or an animation is how a suite becomes
       * slow and flaky at the same time. Wait on a response, or assert
       * web-first and let the expect retry.
       */
      'playwright/no-wait-for-timeout': 'error',
      'playwright/prefer-web-first-assertions': 'error',
      /**
       * An unconditional `.skip()` is dead weight and should be deleted; a
       * conditional one is a guard. sms.spec.ts uses the latter to refuse to
       * send a real text when a provider is configured.
       */
      'playwright/no-skipped-test': ['error', { allowConditional: true }],
      /**
       * The assertions live in `support/locators.ts`, so the plugin has to be
       * told which wrappers count as one — otherwise every test that ends in
       * `expectRowVisible(...)` reads as having no assertion at all.
       */
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
      // depends on nothing. The empty pattern is required, not an oversight.
      'no-empty-pattern': 'off',
    },
  },
];

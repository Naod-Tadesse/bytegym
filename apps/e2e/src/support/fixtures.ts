import { test as base, type APIRequestContext } from '@playwright/test';
import { Api, login } from './api-client';
import { Factories } from './factories';
import { OWNER } from './env';
import { scopeFor } from './unique';
import {
  credentialsFor,
  loadPersonas,
  type PersonaBundle,
  type PersonaKey,
} from './personas';

interface WorkerFixtures {
  /** Owner-authenticated API context. One login per worker, not per test. */
  api: Api;
  /** `E2E-<runId>-w<n>` — the prefix every record this worker creates carries. */
  scope: string;
  /** Personas and branch ids written by the setup project. */
  personas: PersonaBundle;
}

interface TestFixtures {
  /** Arrange helpers. Everything they create is tracked for teardown. */
  data: Factories;
  /** An API context authenticated as any persona, for RBAC and scope cases. */
  as: (key: PersonaKey) => Promise<Api>;
}

export const test = base.extend<TestFixtures, WorkerFixtures>({
  scope: [
    async ({}, use, workerInfo) => {
      await use(scopeFor(workerInfo.workerIndex));
    },
    { scope: 'worker' },
  ],

  personas: [
    async ({}, use) => {
      await use(loadPersonas());
    },
    { scope: 'worker' },
  ],

  api: [
    async ({ playwright }, use) => {
      const ctx = await playwright.request.newContext();
      const tokens = await login(ctx, OWNER);
      await use(new Api(ctx, tokens.accessToken));
      await ctx.dispose();
    },
    { scope: 'worker' },
  ],

  data: async ({ api, scope }, use) => {
    await use(new Factories(api, scope));
  },

  as: async ({ playwright }, use) => {
    const opened: APIRequestContext[] = [];
    await use(async (key: PersonaKey) => {
      const ctx = await playwright.request.newContext();
      opened.push(ctx);
      const tokens = await login(ctx, credentialsFor(key));
      return new Api(ctx, tokens.accessToken);
    });
    for (const ctx of opened) await ctx.dispose();
  },
});

export { expect } from '@playwright/test';

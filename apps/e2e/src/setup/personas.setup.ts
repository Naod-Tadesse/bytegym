import { test as setup, expect, request } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { Api, login } from '../support/api-client';
import { Factories } from '../support/factories';
import { OWNER, WEB_URL, storageStatePath } from '../support/env';
import {
  MANAGER_PERMISSIONS,
  PERSONA_PASSWORD,
  RECEPTION_PERMISSIONS,
  personasPath,
  type Persona,
  type PersonaBundle,
  type PersonaKey,
} from '../support/personas';

/**
 * One setup test, not several: Playwright does not order tests within a
 * project, and the personas must exist before any of them can sign in.
 *
 * Personas are created fresh each run with generated phones and recorded in the
 * run manifest, so teardown removes them. That is deliberately different from
 * reusing fixed accounts — this suite runs against the developer's own
 * database, and a fixed phone could collide with a real person.
 */
setup('create personas and seed storage state', async () => {
  setup.setTimeout(120_000);

  const ctx = await request.newContext();
  const ownerTokens = await login(ctx, OWNER);
  const api = new Api(ctx, ownerTokens.accessToken);
  const data = new Factories(api, `E2E-${process.env.E2E_RUN_ID}-setup`);

  const mainBranch = await data.mainBranch();
  const otherBranch = await data.branch({ city: 'Adama' });

  const receptionRole = await data.role(RECEPTION_PERMISSIONS);
  const managerRole = await data.role(MANAGER_PERMISSIONS);

  const make = async (
    key: PersonaKey,
    opts: {
      branchId: string;
      jobTitleCode: string;
      roleIds?: string[];
      dataScope?: 'branch' | 'all';
    },
  ): Promise<Persona> => {
    const s = await data.staff({
      branchId: opts.branchId,
      jobTitleCode: opts.jobTitleCode,
      password: PERSONA_PASSWORD,
      roleIds: opts.roleIds,
      dataScope: opts.dataScope,
    });
    return {
      key,
      phone: s.phone,
      password: PERSONA_PASSWORD,
      personId: s.id,
      branchId: opts.branchId,
      canSignIn: true,
    };
  };

  const manager = await make('manager', {
    branchId: otherBranch.id,
    jobTitleCode: 'manager',
    roleIds: [managerRole.id],
    dataScope: 'branch',
  });

  const reception = await make('reception', {
    branchId: mainBranch.id,
    jobTitleCode: 'receptionist',
    roleIds: [receptionRole.id],
    dataScope: 'branch',
  });

  // An account with no roles at all: can authenticate, can reach nothing.
  const noaccess = await make('noaccess', {
    branchId: mainBranch.id,
    jobTitleCode: 'receptionist',
    dataScope: 'branch',
  });

  // Disabled keeps the password — that is the whole difference from revoking.
  const disabled = await make('disabled', {
    branchId: mainBranch.id,
    jobTitleCode: 'receptionist',
    dataScope: 'branch',
  });
  expect(
    (await api.patch(`/staff/${disabled.personId}/access`, { status: 'disabled' })).status(),
  ).toBe(200);
  disabled.canSignIn = false;

  const terminated = await make('terminated', {
    branchId: mainBranch.id,
    jobTitleCode: 'receptionist',
    dataScope: 'branch',
  });
  expect((await api.delete(`/staff/${terminated.personId}`)).status()).toBe(200);
  terminated.canSignIn = false;

  // The seeded admin. Never created, never torn down.
  const ownerMe = await api.json<{ id: string; branchId: string }>(
    api.get('/auth/me'),
  );
  const owner: Persona = {
    key: 'owner',
    phone: OWNER.phone,
    password: OWNER.password,
    personId: ownerMe.id,
    branchId: ownerMe.branchId,
    canSignIn: true,
  };

  const bundle: PersonaBundle = {
    personas: { owner, manager, reception, noaccess, disabled, terminated },
    mainBranchId: mainBranch.id,
    otherBranchId: otherBranch.id,
  };

  mkdirSync(dirname(personasPath()), { recursive: true });
  writeFileSync(personasPath(), JSON.stringify(bundle, null, 2));

  // Storage state for everyone who can sign in, so UI specs skip the login form.
  for (const p of Object.values(bundle.personas)) {
    if (!p.canSignIn) continue;
    const tokens = await login(ctx, { phone: p.phone, password: p.password });
    const state = {
      cookies: [],
      origins: [
        {
          // The FRONTEND origin — localStorage is per-origin, and writing it
          // against the API's origin would put the token where the app never
          // looks.
          origin: WEB_URL,
          localStorage: [
            {
              name: 'bytegym-auth',
              // Exactly zustand persist's envelope. auth-store.ts passes no
              // `version`, so it is 0. A malformed envelope is discarded
              // silently on rehydrate and the app bounces to login.
              value: JSON.stringify({
                state: {
                  accessToken: tokens.accessToken,
                  refreshToken: tokens.refreshToken,
                },
                version: 0,
              }),
            },
            { name: 'vite-ui-theme', value: 'dark' },
          ],
        },
      ],
    };
    const file = storageStatePath(p.key);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(state, null, 2));
  }

  await ctx.dispose();
});

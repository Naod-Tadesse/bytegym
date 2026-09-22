import { test, expect } from '../support/fixtures';
import { record } from '../support/manifest';
import { uniquePhone } from '../support/unique';
import { gymToday } from '../support/env';

/**
 * The global ValidationPipe runs with whitelist, transform and
 * enableImplicitConversion. The consequence worth pinning is that an unknown
 * property is silently REMOVED rather than refused — so "the server ignored my
 * field" is the expected outcome, not a 400, and a client cannot tell.
 */
test.describe('whitelist strips rather than rejects', () => {
  test('an unknown property on member create is dropped', async ({ api, data }) => {
    const branch = await data.mainBranch();
    const res = await api.post('/members', {
      firstName: 'E2E',
      lastName: 'Whitelisted',
      phone: uniquePhone(),
      branchId: branch.id,
      isSuspended: true,
      memberCode: 'MBR00001',
      nonsense: 'ignored',
    });
    expect(res.status()).toBe(201);
    const created = await res.json();
    record('member', created.personId);
    record('person', created.personId);

    // Neither client-supplied field was honoured.
    expect(created.isSuspended).toBe(false);
    expect(created.memberCode).not.toBe('MBR00001');
  });

  test('a client-supplied soldByStaffId on a sale is dropped', async ({
    api,
    data,
    personas,
  }) => {
    const member = await data.member();
    const plan = await data.plan();
    const m = await api.json<{ soldByStaffId: string }>(
      api.post('/memberships', {
        memberId: member.id,
        planId: plan.id,
        soldByStaffId: personas.personas.reception.personId,
      }),
    );
    record('memberships', (m as unknown as { id: string }).id);
    expect(m.soldByStaffId).toBe(personas.personas.owner.personId);
  });

  test('a client-supplied branch and date on a check-in are dropped', async ({
    api,
    data,
    personas,
  }) => {
    const { member } = await data.activeMember();
    const res = await api.post('/check-ins', {
      memberId: member.id,
      branchId: personas.otherBranchId,
      checkedInOn: '2019-01-01',
      overrideByStaffId: personas.personas.reception.personId,
    });
    const body = await res.json();
    record('check_ins', String(body.id));
    expect(body.branchId).toBe(personas.mainBranchId);
    expect(body.checkedInOn).toBe(gymToday());
    expect(body.overrideByName).toBeNull();
  });

  test('a client-supplied staffCode is dropped on staff create', async ({ api, data }) => {
    const branch = await data.mainBranch();
    const jt = await data.jobTitle('receptionist');
    const res = await api.post('/staff', {
      firstName: 'E2E',
      lastName: 'Codeless',
      phone: uniquePhone(),
      primaryBranchId: branch.id,
      jobTitleId: jt.id,
      hiredOn: gymToday(),
      staffCode: 'ST00001',
    });
    expect(res.status()).toBe(201);
    const created = await res.json();
    record('staff', created.personId);
    record('person', created.personId);
    expect(created.staffCode).not.toBe('ST00001');
  });
});

test.describe('uuid parsing', () => {
  const ROUTES = [
    '/members/{id}',
    '/staff/{id}',
    '/branches/{id}',
    '/membership-plans/{id}',
    '/memberships/{id}',
    '/roles/{id}',
  ];

  for (const route of ROUTES) {
    test(`${route} rejects a malformed id with 400`, async ({ api }) => {
      for (const bad of ['abc', '123', 'not-a-uuid', '00000000-0000-0000-0000']) {
        const res = await api.get(route.replace('{id}', bad));
        expect(res.status(), `${route} with "${bad}"`).toBe(400);
      }
    });
  }

  test('a well-formed but unknown uuid is a 404, not a 400', async ({ api }) => {
    const unknown = '00000000-0000-4000-8000-000000000000';
    for (const route of ROUTES) {
      const res = await api.get(route.replace('{id}', unknown));
      expect(res.status(), route).toBe(404);
    }
  });
});

test.describe('date-only fields', () => {
  test('reject a full ISO timestamp', async ({ api }) => {
    // DATE_ONLY_PATTERN is paired with @IsDateString({ strict: true }) so a
    // timestamp cannot sneak a timezone into a gym-day comparison.
    for (const path of ['/check-ins', '/payments', '/sms']) {
      const res = await api.get(path, { from: '2026-09-07T00:00:00Z' });
      expect(res.status(), path).toBe(400);
    }
  });

  test('reject a compact date', async ({ api }) => {
    expect((await api.get('/check-ins', { from: '20260907' })).status()).toBe(400);
  });

  test('reject an impossible calendar date', async ({ api }) => {
    expect((await api.get('/check-ins', { from: '2027-02-30' })).status()).toBe(400);
    expect((await api.get('/check-ins', { from: '2027-13-01' })).status()).toBe(400);
  });

  test('accept a well-formed date', async ({ api }) => {
    expect((await api.get('/check-ins', { from: '2026-02-28' })).status()).toBe(200);
  });
});

test.describe('required fields', () => {
  test('member create needs first name, last name, phone and branch', async ({ api }) => {
    expect((await api.post('/members', {})).status()).toBe(400);
  });

  test('staff create needs a branch, job title and hire date', async ({ api }) => {
    expect((await api.post('/staff', { firstName: 'E2E', lastName: 'Bare' })).status()).toBe(
      400,
    );
  });

  test('a sale needs both a member and a plan', async ({ api, data }) => {
    const member = await data.member();
    expect((await api.post('/memberships', { memberId: member.id })).status()).toBe(400);
    expect((await api.post('/memberships', {})).status()).toBe(400);
  });

  test('a payment needs member, membership, amount and method', async ({ api }) => {
    expect((await api.post('/payments', {})).status()).toBe(400);
  });

  test('a check-in needs a member', async ({ api }) => {
    expect((await api.post('/check-ins', {})).status()).toBe(400);
  });

  test('validation errors come back as an array of messages', async ({ api }) => {
    // ErrorResponseDto.message is a oneOf because ValidationPipe returns
    // string[] while ParseUUIDPipe and hand-thrown exceptions return a string.
    const res = await api.post('/members', {});
    const body = await res.json();
    expect(Array.isArray(body.message)).toBe(true);
    expect(body.message.length).toBeGreaterThan(0);

    const single = await api.get('/members/not-a-uuid');
    expect(typeof (await single.json()).message).toBe('string');
  });
});

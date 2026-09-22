import { test, expect } from '../support/fixtures';
import type { Paginated } from '../support/api-client';
import { Api, login } from '../support/api-client';
import { addDays, gymToday } from '../support/env';
import { record } from '../support/manifest';
import { sql } from '../support/db';

interface CheckIn {
  id: number;
  memberId: string;
  memberName: string;
  memberCode: string;
  branchId: string;
  branchName: string;
  recordedByName: string | null;
  overrideByName: string | null;
  checkedInOn: string;
  checkedInAt: string;
}

/**
 * The attendance register is the same GET /check-ins the desk uses, read over a
 * date range instead of today. These cases are about what the register shows —
 * who let them in, and whether it was an override.
 */
test.describe('the attendance register', () => {
  test('names the member and the staff member who recorded the visit', async ({
    api,
    data,
  }) => {
    const { member } = await data.activeMember();
    const created = await api.post('/check-ins', { memberId: member.id });
    record('check_ins', String((await created.json()).id));

    const page = await api.json<Paginated<CheckIn>>(
      api.get('/check-ins', { memberId: member.id }),
    );
    const row = page.data[0];
    expect(row.memberName).toContain(member.lastName);
    expect(row.memberCode).toBe(member.memberCode);
    expect(row.recordedByName).not.toBeNull();
    expect(row.overrideByName).toBeNull();
  });

  test('marks an override with the name of whoever authorised it', async ({
    data,
    request,
  }) => {
    const { member } = await data.expiredMember();
    const role = await data.role(['checkin.record', 'checkin.override', 'checkin.list']);
    const clerk = await data.staff({
      password: 'Override@123',
      roleIds: [role.id],
      dataScope: 'all',
    });
    const tokens = await login(request, { phone: clerk.phone, password: 'Override@123' });
    const clerkApi = new Api(request, tokens.accessToken);

    const created = await clerkApi.post('/check-ins', {
      memberId: member.id,
      override: true,
    });
    record('check_ins', String((await created.json()).id));

    const page = await clerkApi.json<Paginated<CheckIn>>(
      clerkApi.get('/check-ins', { memberId: member.id }),
    );
    expect(page.data[0].overrideByName).toContain(clerk.lastName);
  });

  test('carries the gym day and a full timestamp separately', async ({ api, data }) => {
    // checked_in_on is its own date column, not a cast of checked_in_at: a
    // 01:00 visit in Addis is the previous day in UTC, and the gym day has to
    // win.
    const { member } = await data.activeMember();
    const created = await api.post('/check-ins', { memberId: member.id });
    record('check_ins', String((await created.json()).id));

    const page = await api.json<Paginated<CheckIn>>(
      api.get('/check-ins', { memberId: member.id }),
    );
    expect(page.data[0].checkedInOn).toBe(gymToday());
    expect(Date.parse(page.data[0].checkedInAt)).not.toBeNaN();
  });

  test('a range spanning several days returns visits from each of them', async ({
    api,
    data,
  }) => {
    // Backdated visits can only be made by direct insert — the endpoint always
    // writes the gym's today.
    const { member, membership } = await data.activeMember();
    const branch = await data.mainBranch();

    for (const offset of [-3, -2, -1]) {
      const rows = await sql<{ id: string }>(
        `insert into check_ins (member_id, membership_id, branch_id, checked_in_on, checked_in_at)
         values ($1, $2, $3, $4, now()) returning id`,
        [member.id, membership.id, branch.id, addDays(gymToday(), offset)],
      );
      record('check_ins', rows[0].id);
    }

    const page = await api.json<Paginated<CheckIn>>(
      api.get('/check-ins', {
        memberId: member.id,
        from: addDays(gymToday(), -3),
        to: addDays(gymToday(), -1),
        limit: 50,
      }),
    );
    expect(page.data.length).toBe(3);
    expect(page.data.map((c) => c.checkedInOn).sort()).toEqual([
      addDays(gymToday(), -3),
      addDays(gymToday(), -2),
      addDays(gymToday(), -1),
    ]);
  });

  test('is ordered newest first', async ({ api, data }) => {
    const { member, membership } = await data.activeMember();
    const branch = await data.mainBranch();

    for (const offset of [-5, -4]) {
      const rows = await sql<{ id: string }>(
        `insert into check_ins (member_id, membership_id, branch_id, checked_in_on, checked_in_at)
         values ($1, $2, $3, $4, now()) returning id`,
        [member.id, membership.id, branch.id, addDays(gymToday(), offset)],
      );
      record('check_ins', rows[0].id);
    }

    const page = await api.json<Paginated<CheckIn>>(
      api.get('/check-ins', {
        memberId: member.id,
        from: addDays(gymToday(), -5),
        to: gymToday(),
        limit: 50,
      }),
    );
    const days = page.data.map((c) => c.checkedInOn);
    expect(days).toEqual([...days].sort().reverse());
  });

  test('a member with no visits returns an empty register', async ({ api, data }) => {
    const member = await data.member();
    const page = await api.json<Paginated<CheckIn>>(
      api.get('/check-ins', { memberId: member.id }),
    );
    expect(page.data).toEqual([]);
    expect(page.meta.totalPages).toBe(1);
  });
});

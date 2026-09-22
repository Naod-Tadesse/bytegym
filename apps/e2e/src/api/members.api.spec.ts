import { test, expect } from '../support/fixtures';
import type { Paginated } from '../support/api-client';
import { record } from '../support/manifest';
import { uniquePhone } from '../support/unique';
import { peek } from '../support/db';
import { RUN_ID } from '../support/env';

interface Member {
  personId: string;
  memberCode: string;
  firstName: string;
  lastName: string;
  phone: string;
  branchId: string;
  branchName: string;
  isSuspended: boolean;
  membershipStatus: 'active' | 'expired' | 'never';
  expiresOn: string | null;
  emergencyContactName: string | null;
  emergencyContactPhone: string | null;
}

const create = async (
  api: { post: (p: string, d: unknown) => Promise<{ status: () => number; json: () => Promise<unknown> }> },
  body: Record<string, unknown>,
) => api.post('/members', body);

test.describe('members', () => {
  test('creates a member and assigns a sequential code', async ({ api, data }) => {
    const branch = await data.mainBranch();
    const phone = uniquePhone();
    const res = await create(api, {
      firstName: 'E2E',
      lastName: 'Codecheck',
      phone,
      branchId: branch.id,
    });
    expect(res.status()).toBe(201);
    const member = (await res.json()) as Member;
    record('member', member.personId);
    record('person', member.personId);

    // Never assert an absolute code — the sequence is shared with every other
    // member ever created. The shape is the contract.
    expect(member.memberCode).toMatch(/^MBR\d{5}$/);
    expect(member).toMatchObject({ phone, isSuspended: false });
  });

  test('a brand new member has never held a membership', async ({ api, data }) => {
    // Status is derived from the memberships table at query time, never stored.
    const m = await data.member();
    const got = await api.json<Member>(api.get(`/members/${m.id}`));
    expect(got.membershipStatus).toBe('never');
    expect(got.expiresOn).toBeNull();
  });

  test('rejects a phone that fails the local Ethiopian pattern', async ({ api, data }) => {
    const branch = await data.mainBranch();
    const res = await create(api, {
      firstName: 'E2E',
      lastName: 'Badphone',
      phone: '0612345678',
      branchId: branch.id,
    });
    expect(res.status()).toBe(400);
    expect(String((await res.json() as { message: string }).message)).toContain(
      '07 or 09',
    );
  });

  test('normalises a pasted +251 number to local form', async ({ api, data }) => {
    const branch = await data.mainBranch();
    const local = uniquePhone();
    const res = await create(api, {
      firstName: 'E2E',
      lastName: 'Normalised',
      phone: `+251${local.slice(1)}`,
      branchId: branch.id,
    });
    expect(res.status()).toBe(201);
    const member = (await res.json()) as Member;
    record('member', member.personId);
    record('person', member.personId);
    // Stored local, never +251 — which is why person.phone can stay unique.
    expect(member.phone).toBe(local);
  });

  test('strips spaces and dashes from a pasted number', async ({ api, data }) => {
    const branch = await data.mainBranch();
    const local = uniquePhone();
    const spaced = `${local.slice(0, 4)} ${local.slice(4, 7)}-${local.slice(7)}`;
    const res = await create(api, {
      firstName: 'E2E',
      lastName: 'Spaced',
      phone: spaced,
      branchId: branch.id,
    });
    expect(res.status()).toBe(201);
    const member = (await res.json()) as Member;
    record('member', member.personId);
    record('person', member.personId);
    expect(member.phone).toBe(local);
  });

  test('rejects a phone already held by a live person', async ({ api, data }) => {
    const existing = await data.member();
    const branch = await data.mainBranch();
    const res = await create(api, {
      firstName: 'E2E',
      lastName: 'Duplicate',
      phone: existing.phone,
      branchId: branch.id,
    });
    expect(res.status()).toBe(409);
    expect((await res.json() as { message: string }).message).toBe(
      'A person with this phone number already exists',
    );
  });

  test('rejects a phone already held by a staff member', async ({ api, data }) => {
    // person is one table: registering a colleague's number as a member is the
    // same collision, and it has to say so rather than silently making a second
    // person row.
    const staff = await data.staff();
    const branch = await data.mainBranch();
    const res = await create(api, {
      firstName: 'E2E',
      lastName: 'Colleague',
      phone: staff.phone,
      branchId: branch.id,
    });
    expect(res.status()).toBe(409);
  });

  test('a phone freed by a soft-deleted member can be reused', async ({ api, data }) => {
    // person_phone_active_uniq is partial on deleted_at is null, so removing
    // someone must hand their number back.
    const first = await data.member();
    await api.delete(`/members/${first.id}`);

    const branch = await data.mainBranch();
    const res = await create(api, {
      firstName: 'E2E',
      lastName: 'Reuser',
      phone: first.phone,
      branchId: branch.id,
    });
    expect(res.status()).toBe(201);
    const member = (await res.json()) as Member;
    record('member', member.personId);
    record('person', member.personId);
  });

  test('rejects an unknown branch', async ({ api }) => {
    // KNOWN BUG — currently answers 500, not 400/404.
    //
    // jobTitleId is looked up and gets a clean "Job title not found", but
    // branchId goes straight into the insert and trips the member -> branches
    // foreign key. pg-errors.ts maps 23505 and 23P01 but not 23503, so it
    // escapes unhandled. Same root cause as the unknown-permission-id case in
    // roles.api.spec.ts.
    test.fail();
    const res = await create(api, {
      firstName: 'E2E',
      lastName: 'Nobranch',
      phone: uniquePhone(),
      branchId: '00000000-0000-4000-8000-000000000000',
    });
    expect([400, 404]).toContain(res.status());
  });

  test('updates names and the emergency contact', async ({ api, data }) => {
    const m = await data.member();
    const updated = await api.json<Member>(
      api.patch(`/members/${m.id}`, {
        firstName: 'E2E',
        lastName: 'Updated',
        emergencyContactName: 'Next of kin',
        emergencyContactPhone: '0911 000 111',
      }),
    );
    expect(updated).toMatchObject({
      lastName: 'Updated',
      emergencyContactName: 'Next of kin',
    });
  });

  test('the emergency contact phone is free text, not a validated mobile', async ({
    api,
    data,
  }) => {
    const m = await data.member();
    const res = await api.patch(`/members/${m.id}`, {
      emergencyContactPhone: 'ask at reception',
    });
    expect(res.status()).toBe(200);
  });

  test('ignores an attempt to change the phone', async ({ api, data }) => {
    // phone is immutable on update and has no decorator on UpdateMemberDto, so
    // whitelist strips it rather than rejecting the request.
    const m = await data.member();
    const wanted = uniquePhone();
    const updated = await api.json<Member>(
      api.patch(`/members/${m.id}`, { phone: wanted }),
    );
    expect(updated.phone).toBe(m.phone);
  });

  test('ignores an attempt to change the member code', async ({ api, data }) => {
    const m = await data.member();
    const updated = await api.json<Member>(
      api.patch(`/members/${m.id}`, { memberCode: 'MBR99999' }),
    );
    expect(updated.memberCode).toBe(m.memberCode);
  });

  test('suspends and then lifts the suspension', async ({ api, data }) => {
    const m = await data.member();
    expect(
      (await api.json<Member>(
        api.patch(`/members/${m.id}/suspension`, { isSuspended: true }),
      )).isSuspended,
    ).toBe(true);
    expect(
      (await api.json<Member>(
        api.patch(`/members/${m.id}/suspension`, { isSuspended: false }),
      )).isSuspended,
    ).toBe(false);
  });

  test('coerces a truthy string suspension rather than rejecting it', async ({
    api,
    data,
  }) => {
    // ValidationPipe runs with enableImplicitConversion, so @IsBoolean() sees an
    // already-converted value and a non-empty string arrives as true. Worth
    // pinning: it means the endpoint is lenient about what "suspend" looks like,
    // and a client sending "false" would suspend rather than release.
    const m = await data.member();
    const res = await api.patch(`/members/${m.id}/suspension`, { isSuspended: 'yes' });
    expect(res.status()).toBe(200);
    expect((await res.json()).isSuspended).toBe(true);
  });

  test('rejects a suspension payload with no field at all', async ({ api, data }) => {
    const m = await data.member();
    expect((await api.patch(`/members/${m.id}/suspension`, {})).status()).toBe(400);
  });

  test('soft-deletes a member, who then 404s', async ({ api, data }) => {
    const m = await data.member();
    const res = await api.delete(`/members/${m.id}`);
    expect(res.status()).toBe(200);
    expect(await res.json()).toMatchObject({ id: m.id });

    expect((await api.get(`/members/${m.id}`)).status()).toBe(404);

    // The person row survives with deleted_at set; the member row stays so
    // their payments and check-ins still resolve.
    const [person] = await peek.person(m.id);
    expect(person.deleted_at).not.toBeNull();
  });

  test('a soft-deleted member disappears from the list', async ({ api, data }) => {
    const m = await data.member();
    await api.delete(`/members/${m.id}`);
    const page = await api.json<Paginated<Member>>(
      api.get('/members', { search: m.lastName }),
    );
    expect(page.data.map((x) => x.personId)).not.toContain(m.id);
  });

  test('searches by last name, phone and member code', async ({ api, data }) => {
    const m = await data.member();
    for (const term of [m.lastName, m.phone, m.memberCode]) {
      const page = await api.json<Paginated<Member>>(api.get('/members', { search: term }));
      expect(page.data.map((x) => x.personId)).toContain(m.id);
    }
  });

  test('a search that cannot match returns an empty page with totalPages 1', async ({
    api,
  }) => {
    // totalPages is max(1, ceil(total/limit)) — never 0, so the UI never shows
    // "page 1 of 0".
    const page = await api.json<Paginated<Member>>(
      api.get('/members', { search: `no-such-member-${RUN_ID()}` }),
    );
    expect(page.data).toEqual([]);
    expect(page.meta.total).toBe(0);
    expect(page.meta.totalPages).toBe(1);
  });

  test('returns 404 for an unknown member', async ({ api }) => {
    const res = await api.get('/members/00000000-0000-4000-8000-000000000000');
    expect(res.status()).toBe(404);
    expect((await res.json()).message).toBe('Member not found');
  });

  test('rejects a non-uuid member id', async ({ api }) => {
    expect((await api.get('/members/nope')).status()).toBe(400);
  });
});

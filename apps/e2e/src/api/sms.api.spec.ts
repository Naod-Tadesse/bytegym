import { test, expect } from '../support/fixtures';
import type { Paginated } from '../support/api-client';
import { record } from '../support/manifest';
import { REAL_TEST_HANDSET, uniquePhone } from '../support/unique';


interface SmsMessage {
  id: string;
  phone: string;
  memberId: string | null;
  body: string;
  kind: 'direct' | 'bulk' | 'reminder';
  status: 'sent' | 'failed' | 'held';
  error: string | null;
  sentOn: string;
}

interface SmsSettings {
  reminderEnabled: boolean;
  reminderDaysBefore: number;
  reminderHour: number;
  reminderTemplate: string;
}

/**
 * SMS_API_KEY in .env is a LIVE key against smsethiopia.et, and the allowlist
 * defaults to the gym's real handset. Every assertion here is on status
 * 'held' — the suite must never produce a 'sent'. Nothing in this file may set
 * SMS_ALLOWED_RECIPIENTS, and uniquePhone() refuses to generate the handset.
 */
test.describe('sending', () => {
  test('a message to a number outside the allowlist is held, not sent', async ({ api }) => {
    const phone = uniquePhone();
    const res = await api.post('/sms/send', { phone, message: 'E2E held message' });

    // Always 201 even when nothing leaves the building: the outcome is in the
    // body, not the status code. Note this returns a delivery result — not the
    // logged SmsMessage — so there is no id to follow.
    expect(res.status()).toBe(201);
    const result = (await res.json()) as {
      delivered: boolean;
      held: boolean;
      error: string | null;
      alreadySentToday: boolean;
    };
    expect(result.delivered).toBe(false);
    expect(result.held).toBe(true);
    expect(result.error).toContain('allowlist');
  });

  test('the held message is logged as a direct message', async ({ api }) => {
    const phone = uniquePhone();
    await api.post('/sms/send', { phone, message: 'E2E logged probe' });

    const page = await api.json<Paginated<SmsMessage>>(api.get('/sms', { search: phone }));
    expect(page.data.length).toBeGreaterThan(0);
    expect(page.data[0]).toMatchObject({ kind: 'direct', status: 'held', phone });
  });

  test('never generates the gyms real test handset', () => {
    // A guard on the guard: if uniquePhone() ever produced this number, a test
    // would put a real text on a real phone.
    for (let i = 0; i < 2000; i += 1) {
      expect(uniquePhone()).not.toBe(REAL_TEST_HANDSET);
    }
  });

  test('rejects a phone outside the local pattern', async ({ api }) => {
    expect((await api.post('/sms/send', { phone: '0612345678', message: 'x' })).status()).toBe(
      400,
    );
  });

  test('rejects an empty message', async ({ api }) => {
    expect((await api.post('/sms/send', { phone: uniquePhone(), message: '' })).status()).toBe(
      400,
    );
  });

  test('rejects a message over 640 characters', async ({ api }) => {
    const res = await api.post('/sms/send', {
      phone: uniquePhone(),
      message: `E2E${'x'.repeat(638)}`,
    });
    expect(res.status()).toBe(400);
  });

  test('accepts exactly 640 characters', async ({ api }) => {
    const res = await api.post('/sms/send', {
      phone: uniquePhone(),
      message: `E2E${'x'.repeat(637)}`,
    });
    expect(res.status()).toBe(201);
  });
});

test.describe('broadcast', () => {
  test('preview counts recipients without writing any messages', async ({ api }) => {
    // Scoped to this message's own text: a global row count would be changed by
    // any other worker sending in the meantime.
    const body = `E2E preview only ${Date.now()}`;

    const preview = await api.json<{ recipients: number }>(
      api.post('/sms/broadcast/preview', { audience: 'all', message: body }),
    );
    expect(preview.recipients).toEqual(expect.any(Number));

    const logged = await api.json<Paginated<SmsMessage>>(
      api.get('/sms', { search: body, limit: 5 }),
    );
    expect(logged.data).toEqual([]);
  });

  test('preview scoped to a plan counts only that plans members', async ({ api, data }) => {
    const plan = await data.plan({ durationDays: 30 });
    const member = await data.member();
    await data.membership({ memberId: member.id, planId: plan.id });

    const preview = await api.json<{ recipients: number }>(
      api.post('/sms/broadcast/preview', {
        audience: 'plan',
        planId: plan.id,
        message: 'Plan only',
      }),
    );
    // Our fresh plan has exactly the one member we just sold to.
    expect(preview.recipients).toBe(1);
  });

  test('rejects a plan audience with no plan id', async ({ api }) => {
    // KNOWN BUG — currently answers 500, not 400.
    //
    // audience: 'plan' without planId is a contradiction the DTO does not
    // catch: planId is @IsOptional() with no conditional validation, so a null
    // plan id reaches the query. Either @ValidateIf(o => o.audience === 'plan')
    // on planId, or an explicit check in the service, would make this a 400.
    test.fail();
    const res = await api.post('/sms/broadcast/preview', {
      audience: 'plan',
      message: 'E2E no plan',
    });
    expect(res.status()).toBe(400);
  });

  test('rejects an audience outside the enum', async ({ api }) => {
    const res = await api.post('/sms/broadcast/preview', {
      audience: 'everyone',
      message: 'Nope',
    });
    expect(res.status()).toBe(400);
  });

  test('a plan broadcast writes one held row per recipient', async ({ api, data }) => {
    const plan = await data.plan({ durationDays: 30 });
    const member = await data.member();
    await data.membership({ memberId: member.id, planId: plan.id });

    const result = await api.json<{ recipients: number }>(
      api.post('/sms/broadcast', {
        audience: 'plan',
        planId: plan.id,
        message: 'E2E broadcast',
      }),
    );
    expect(result.recipients).toBe(1);

    await expect
      .poll(async () => {
        const page = await api.json<Paginated<SmsMessage>>(
          api.get('/sms', { memberId: member.id, limit: 10 }),
        );
        return page.data.length;
      })
      .toBeGreaterThan(0);

    const page = await api.json<Paginated<SmsMessage>>(
      api.get('/sms', { memberId: member.id, limit: 10 }),
    );
    for (const m of page.data) record('sms_messages', m.id);
    expect(page.data[0]).toMatchObject({ kind: 'bulk', status: 'held' });
  });
});

test.describe('the sms log', () => {
  test('filters by kind and by status', async ({ api }) => {
    await api.post('/sms/send', { phone: uniquePhone(), message: 'E2E filter probe' });

    const byKind = await api.json<Paginated<SmsMessage>>(
      api.get('/sms', { kind: 'direct', limit: 50 }),
    );
    expect(byKind.data.every((m) => m.kind === 'direct')).toBe(true);

    const byStatus = await api.json<Paginated<SmsMessage>>(
      api.get('/sms', { status: 'held', limit: 50 }),
    );
    expect(byStatus.data.every((m) => m.status === 'held')).toBe(true);
  });

  test('rejects a kind outside the enum', async ({ api }) => {
    expect((await api.get('/sms', { kind: 'carrier-pigeon' })).status()).toBe(400);
  });

  test('searches by number and by body', async ({ api }) => {
    const phone = uniquePhone();
    const marker = `E2E-marker-${Date.now()}`;
    await api.post('/sms/send', { phone, message: marker });

    for (const term of [phone, marker]) {
      const page = await api.json<Paginated<SmsMessage>>(api.get('/sms', { search: term }));
      expect(page.data.length).toBeGreaterThan(0);
    }
  });

  test('rejects a malformed date filter', async ({ api }) => {
    expect((await api.get('/sms', { from: 'last week' })).status()).toBe(400);
  });
});

/**
 * sms_settings is a single shared row, so these cannot run in parallel with
 * each other — one test's write would be another's read.
 */
test.describe('reminder settings', () => {
  test.describe.configure({ mode: 'serial' });

  test('reading the settings creates the row and never 404s', async ({ api }) => {
    const settings = await api.json<SmsSettings>(api.get('/sms/settings'));
    expect(settings).toMatchObject({
      reminderEnabled: expect.any(Boolean),
      reminderDaysBefore: expect.any(Number),
      reminderHour: expect.any(Number),
    });
  });

  test('rejects a reminder hour outside 0-23', async ({ api }) => {
    expect((await api.patch('/sms/settings', { reminderHour: 24 })).status()).toBe(400);
    expect((await api.patch('/sms/settings', { reminderHour: -1 })).status()).toBe(400);
  });

  test('rejects reminderDaysBefore outside 1-365', async ({ api }) => {
    expect((await api.patch('/sms/settings', { reminderDaysBefore: 0 })).status()).toBe(400);
    expect((await api.patch('/sms/settings', { reminderDaysBefore: 366 })).status()).toBe(400);
  });

  test('updates and then restores the settings', async ({ api }) => {
    const before = await api.json<SmsSettings>(api.get('/sms/settings'));

    const updated = await api.json<SmsSettings>(
      api.patch('/sms/settings', { reminderHour: 9, reminderDaysBefore: 5 }),
    );
    expect(updated).toMatchObject({ reminderHour: 9, reminderDaysBefore: 5 });

    // Shared global state: put it back exactly as it was.
    await api.patch('/sms/settings', {
      reminderHour: before.reminderHour,
      reminderDaysBefore: before.reminderDaysBefore,
      reminderEnabled: before.reminderEnabled,
    });
  });

  test('running the reminder job with reminders disabled sends nothing', async ({ api }) => {
    const before = await api.json<SmsSettings>(api.get('/sms/settings'));
    await api.patch('/sms/settings', { reminderEnabled: false });

    const result = await api.json<{ sent: number; skipped: number; reason: string | null }>(
      api.post('/sms/reminders/run'),
    );
    expect(result.sent).toBe(0);
    expect(result.reason).not.toBeNull();

    await api.patch('/sms/settings', { reminderEnabled: before.reminderEnabled });
  });
});

test.describe('the three sms permissions are distinct', () => {
  test('sms.list alone cannot send or broadcast or read settings', async ({ as }) => {
    // Reception holds sms.list only.
    const reception = await as('reception');
    expect((await reception.get('/sms')).status()).toBe(200);
    expect(
      (await reception.post('/sms/send', { phone: uniquePhone(), message: 'x' })).status(),
    ).toBe(403);
    expect(
      (await reception.post('/sms/broadcast/preview', { audience: 'all', message: 'x' })).status(),
    ).toBe(403);
    expect((await reception.get('/sms/settings')).status()).toBe(403);
  });
});

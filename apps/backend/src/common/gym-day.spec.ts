import { addDaysISO, DATE_ONLY_PATTERN, gymHour, gymToday } from './gym-day';

/**
 * The gym runs on Africa/Addis_Ababa (UTC+3, no DST) and the server runs on
 * UTC. Every case here is about that three-hour gap: between midnight and
 * 03:00 local, UTC is still on yesterday, which is the gym's busiest shift.
 */
describe('gymToday', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns a date-only ISO string', () => {
    expect(gymToday()).toMatch(DATE_ONLY_PATTERN);
  });

  it('is already tomorrow when UTC is still on yesterday evening', () => {
    // 22:00 UTC is 01:00 the next day in Addis. A membership sold now must
    // start on the gym's date, not the server's.
    jest.useFakeTimers().setSystemTime(new Date('2026-09-21T22:00:00Z'));
    expect(gymToday()).toBe('2026-09-22');
  });

  it('agrees with UTC during the rest of the day', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-21T09:00:00Z'));
    expect(gymToday()).toBe('2026-09-21');
  });

  it('has not rolled over just before the gym midnight', () => {
    // 20:59 UTC is 23:59 in Addis — still the 21st.
    jest.useFakeTimers().setSystemTime(new Date('2026-09-21T20:59:59Z'));
    expect(gymToday()).toBe('2026-09-21');
  });

  it('rolls over exactly at the gym midnight', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-21T21:00:00Z'));
    expect(gymToday()).toBe('2026-09-22');
  });

  it('differs from the naive UTC answer in the early hours', () => {
    // This is the bug the helper exists to prevent, stated directly.
    jest.useFakeTimers().setSystemTime(new Date('2026-09-21T23:30:00Z'));
    const naive = new Date().toISOString().slice(0, 10);
    expect(naive).toBe('2026-09-21');
    expect(gymToday()).toBe('2026-09-22');
  });
});

describe('gymHour', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('is three hours ahead of UTC', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-21T06:00:00Z'));
    expect(gymHour()).toBe(9);
  });

  it('wraps past midnight rather than reading 24', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-09-21T21:30:00Z'));
    expect(gymHour()).toBe(0);
  });

  it('reads midnight as 0, not 24', () => {
    // en-GB with hour12: false can render midnight as "24"; anything relying
    // on this for a cron comparison would then never fire.
    jest.useFakeTimers().setSystemTime(new Date('2026-09-21T21:00:00Z'));
    expect(gymHour()).toBe(0);
  });

  it('stays within 0-23 across a whole day', () => {
    for (let utcHour = 0; utcHour < 24; utcHour += 1) {
      jest
        .useFakeTimers()
        .setSystemTime(
          new Date(`2026-09-21T${String(utcHour).padStart(2, '0')}:00:00Z`),
        );
      const hour = gymHour();
      expect(hour).toBeGreaterThanOrEqual(0);
      expect(hour).toBeLessThanOrEqual(23);
    }
  });
});

describe('addDaysISO', () => {
  it('adds whole days', () => {
    expect(addDaysISO('2026-09-21', 1)).toBe('2026-09-22');
    expect(addDaysISO('2026-09-21', 29)).toBe('2026-10-20');
  });

  it('subtracts with a negative count', () => {
    expect(addDaysISO('2026-09-21', -1)).toBe('2026-09-20');
  });

  it('returns the same day for zero', () => {
    // `endsOn = startsOn + durationDays - 1`, so a one-day plan lands here.
    expect(addDaysISO('2026-09-21', 0)).toBe('2026-09-21');
  });

  it('crosses month and year boundaries', () => {
    expect(addDaysISO('2026-09-30', 1)).toBe('2026-10-01');
    expect(addDaysISO('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('handles a leap day', () => {
    expect(addDaysISO('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDaysISO('2028-02-29', 1)).toBe('2028-03-01');
  });

  it('skips 29 February in a common year', () => {
    expect(addDaysISO('2027-02-28', 1)).toBe('2027-03-01');
  });

  it.each([
    ['2027-02-30', 'a date that does not exist would silently roll to March'],
    ['2026-13-01', 'month 13'],
    ['2026-09-21T00:00:00Z', 'a timestamp parses but is not date-only'],
    ['20260921', 'no separators'],
    ['not-a-date', 'nonsense'],
  ])('refuses %s (%s)', (iso) => {
    // Defence in depth behind the DTO: without it `ends_on` would be computed
    // from a day `starts_on` never was.
    expect(() => addDaysISO(iso, 1)).toThrow(RangeError);
  });

  it('is pure calendar arithmetic, independent of the machine timezone', () => {
    // Built on Date.UTC so a local-time Date cannot cross a DST boundary and
    // land a day out. Ethiopia has no DST, but this must not depend on that.
    const original = process.env.TZ;
    try {
      process.env.TZ = 'Pacific/Auckland';
      expect(addDaysISO('2026-09-21', 1)).toBe('2026-09-22');
      process.env.TZ = 'America/Los_Angeles';
      expect(addDaysISO('2026-09-21', 1)).toBe('2026-09-22');
    } finally {
      process.env.TZ = original;
    }
  });
});

describe('DATE_ONLY_PATTERN', () => {
  it('accepts a plain calendar date', () => {
    expect(DATE_ONLY_PATTERN.test('2026-09-21')).toBe(true);
  });

  it.each(['2026-09-21T00:00:00Z', '20260921', '2026-9-21', '21-09-2026'])(
    'rejects %s',
    (value) => {
      // The pattern is paired with @IsDateString({ strict: true }) on every
      // from/to filter: this rejects the shape, that rejects impossible dates.
      expect(DATE_ONLY_PATTERN.test(value)).toBe(false);
    },
  );
});

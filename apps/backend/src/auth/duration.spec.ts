import { parseDurationToSeconds } from './duration';

/**
 * Token lifetimes come from the environment, so a typo here is a boot-time
 * failure rather than a token that silently never expires.
 */
describe('parseDurationToSeconds', () => {
  it.each([
    ['30s', 30],
    ['15m', 900],
    ['1h', 3600],
    ['7d', 604800],
    ['0s', 0],
  ])('reads %s as %i seconds', (value, expected) => {
    expect(parseDurationToSeconds(value)).toBe(expected);
  });

  it('tolerates surrounding whitespace', () => {
    // A trailing space in a .env line is invisible and should not stop a boot.
    expect(parseDurationToSeconds('  15m  ')).toBe(900);
  });

  it.each([
    ['15', 'no unit'],
    ['m', 'no number'],
    ['15w', 'weeks are not a supported unit'],
    ['15M', 'units are lower-case only'],
    ['1.5h', 'no fractions'],
    ['-5m', 'no negatives'],
    ['15m30s', 'one unit at a time'],
    ['', 'empty'],
  ])('throws on %s (%s)', (value) => {
    expect(() => parseDurationToSeconds(value)).toThrow(/Invalid duration/);
  });

  it('names the offending value in the message', () => {
    // The whole point is that whoever mistyped JWT_EXPIRATION can see what
    // they typed without going to look.
    expect(() => parseDurationToSeconds('15 minutes')).toThrow('15 minutes');
  });
});

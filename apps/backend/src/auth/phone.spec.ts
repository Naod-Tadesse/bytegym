import { normalisePhone, PHONE_REGEX } from './phone';

/**
 * Phone numbers are stored in local Ethiopian form and `person.phone` is
 * unique, so normalisation is what stops the same human being registered twice
 * under `0912345678` and `+251912345678`.
 */
describe('PHONE_REGEX', () => {
  it.each(['0912345678', '0712345678', '0900000000', '0799999999'])(
    'accepts %s',
    (phone) => {
      expect(PHONE_REGEX.test(phone)).toBe(true);
    },
  );

  it.each([
    ['0612345678', 'a network prefix the country does not use'],
    ['0812345678', 'likewise'],
    ['912345678', 'no leading zero'],
    ['091234567', 'one digit short'],
    ['09123456789', 'one digit long'],
    ['+251912345678', 'international form, which is normalised before matching'],
    ['09 1234 5678', 'spaces, which are stripped before matching'],
    ['09123456ab', 'letters'],
    ['', 'empty'],
  ])('rejects %s (%s)', (phone) => {
    expect(PHONE_REGEX.test(phone)).toBe(false);
  });
});

describe('normalisePhone', () => {
  it('leaves an already-local number alone', () => {
    expect(normalisePhone('0912345678')).toBe('0912345678');
  });

  it('converts a +251 prefix to a leading zero', () => {
    expect(normalisePhone('+251912345678')).toBe('0912345678');
  });

  it('converts a bare 251 prefix too', () => {
    // Pasted from a contact list that drops the plus.
    expect(normalisePhone('251912345678')).toBe('0912345678');
  });

  it('strips spaces, dashes and brackets', () => {
    expect(normalisePhone('091 234 5678')).toBe('0912345678');
    expect(normalisePhone('091-234-5678')).toBe('0912345678');
    expect(normalisePhone('(091) 234-5678')).toBe('0912345678');
  });

  it('strips separators before deciding on the prefix', () => {
    // The order matters: a number written "+251 91 234 5678" only looks like
    // an international one once the spaces are gone.
    expect(normalisePhone('+251 91 234 5678')).toBe('0912345678');
  });

  it('produces something the regex accepts, which is the whole point', () => {
    for (const written of [
      '+251912345678',
      '251912345678',
      '091 234 5678',
      '(0912) 345-678',
    ]) {
      expect(PHONE_REGEX.test(normalisePhone(written))).toBe(true);
    }
  });

  it('does not invent a valid number out of a bad one', () => {
    // Normalising is not validating. `0612345678` is tidy and still wrong, and
    // it has to reach the regex still wrong.
    expect(PHONE_REGEX.test(normalisePhone('06 1234 5678'))).toBe(false);
  });

  it('leaves a 251 that is part of the subscriber number alone', () => {
    // Only a *leading* 251 is a country code. This number starts 09.
    expect(normalisePhone('0925112345')).toBe('0925112345');
  });
});

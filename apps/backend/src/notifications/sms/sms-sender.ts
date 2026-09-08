/**
 * The port every SMS provider plugs into.
 *
 * An interface rather than a concrete client because the provider is the part
 * most likely to change — a gym switches bulk-SMS vendor for a better rate, and
 * that must not reach past this file. Callers never see a provider name.
 *
 * `send` **resolves either way**. Delivery is best-effort by nature: the
 * handset may be off, the vendor may be down, the balance may have run out.
 * A caller that has just taken money must not have its transaction unwound
 * because a text did not go out — see `NotificationsService.sendSms`, which is
 * where that guarantee is actually made.
 */
export interface SmsSender {
  /**
   * @param phone Local Ethiopian form, `0912345678` — the form the database
   *   stores. Converting to whatever the provider wants is the adapter's job,
   *   not the caller's.
   * @param message Plain text. Nothing here templates or translates it.
   */
  send(phone: string, message: string): Promise<SmsResult>;
}

export interface SmsResult {
  delivered: boolean;
  /**
   * The test allowlist stopped it: nothing was attempted, nothing was charged.
   *
   * Its own field rather than something to be read out of `error`, because a
   * caller has to tell "we did not send this on purpose" from "the provider
   * refused it" — and matching on the wording of a message is a coupling that
   * breaks silently the first time somebody improves the sentence.
   */
  held?: boolean;
  /** The provider's own id, when it gives one — for chasing a missing message. */
  reference?: string;
  /** Why not, when `delivered` is false. Logged, never shown to a member. */
  error?: string;
}

/**
 * DI token. `SmsSender` is an interface, which does not exist at runtime, so
 * Nest needs something it can key the provider off.
 */
export const SMS_SENDER = Symbol('SMS_SENDER');

/**
 * `0912345678` → `251912345678`.
 *
 * The database deliberately holds the local form — staff type the number they
 * know — so the country code goes on here, at the boundary, exactly as
 * `phone.ts` says it should. The leading zero is what `251` replaces.
 *
 * **No `+`.** SMS Ethiopia's `msisdn` is bare digits; a plus sign is not a
 * harmless extra, it is a different string to the gateway. Providers differ on
 * this, which is why the conversion lives with the adapters rather than being
 * done once by the caller.
 */
export function toMsisdn(phone: string): string {
  const trimmed = phone.trim().replace(/^\+/, '');
  if (trimmed.startsWith('0')) return `251${trimmed.slice(1)}`;
  if (trimmed.startsWith('251')) return trimmed;
  return trimmed;
}

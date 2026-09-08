import type { TableState } from '@/services/pagination';

/** Mirrors `SmsKind`. Why the message went out. */
export type SmsKind = 'direct' | 'bulk' | 'reminder';
export const SMS_KINDS: SmsKind[] = ['direct', 'bulk', 'reminder'];

/**
 * Mirrors `SmsStatus`.
 *
 * `held` is **not** a kind of failure: the test allowlist stopped it, so
 * nothing was attempted and nothing was charged. The gym has to be able to tell
 * that from a provider rejection.
 */
export type SmsStatus = 'sent' | 'failed' | 'held';
export const SMS_STATUSES: SmsStatus[] = ['sent', 'failed', 'held'];

/** Hand-written mirror of `SmsMessageDto`. There is no codegen. */
export interface SmsMessage {
  id: string;
  /** Local form, as stored — `0912345678`. */
  phone: string;
  /** Null when the number belongs to no member. Not an error. */
  memberId: string | null;
  memberName: string | null;
  /** The text as it was actually sent, not a template id. */
  body: string;
  kind: SmsKind;
  status: SmsStatus;
  error: string | null;
  /** The **gym's** day, not the browser's. */
  sentOn: string;
  createdAt: string;
}

/** Mirror of `SmsSettingsDto`. */
export interface SmsSettings {
  reminderEnabled: boolean;
  /**
   * Reminders start this many days out and repeat **daily** until the
   * membership lapses — so this is also how many messages each expiring member
   * costs.
   */
  reminderDaysBefore: number;
  /**
   * The hour of the **gym's** day they go out, 0–23 — Africa/Addis_Ababa, not
   * the browser's clock.
   */
  reminderHour: number;
  reminderTemplate: string;
  updatedAt: string;
  updatedByStaffId: string | null;
}

export interface SmsTableState extends TableState {
  kind?: SmsKind;
  status?: SmsStatus;
  from?: string;
  to?: string;
}

/** Who a broadcast reaches. */
export type BroadcastAudience = 'all' | 'plan';

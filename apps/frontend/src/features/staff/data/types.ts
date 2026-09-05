import type { TableState } from '@/services/pagination';

export type EmploymentStatus = 'active' | 'on_leave' | 'terminated';

/** `branch` confines every query to the staff member's branch. */
export type DataScope = 'branch' | 'all';
/** The state of a login. `null` on the wire means they have no account. */
export type AccountStatus = 'active' | 'disabled';
export type Gender = 'male' | 'female';

/** The identifier is the person id — staff_profiles is keyed by it. */
export interface StaffListItem {
  personId: string;
  staffCode: string;
  /** The label. Send `jobTitleId` back on write, never this. */
  jobTitle: string;
  jobTitleId: string;
  /**
   * Whether an account row exists — the existence of that row *is* the right
   * to sign in. `false` is a cleaner: a full employee with no login at all,
   * not a disabled one.
   */
  hasAccount: boolean;
  employmentStatus: EmploymentStatus;
  dataScope: DataScope;
  hiredOn: string;
  firstName: string;
  lastName: string;
  phone: string;
  status: AccountStatus | null;
  /**
   * Sourced from the account, so always `null` when `hasAccount` is false —
   * and also null for an account granted but never used, which is a real
   * answer rather than missing data.
   *
   * On the list as well as the detail: the Users screen shows it per row, and
   * fetching each detail to fill the column would be an N+1.
   */
  lastLoginAt: string | null;
  branchId: string;
  branchName: string;
  createdAt: string;
  roles: { id: string; name: string }[];
}

export interface StaffDetail extends StaffListItem {
  terminatedOn: string | null;
  dateOfBirth: string | null;
  gender: Gender | null;
  updatedAt: string;
}

export type StaffTableState = TableState;

import type { AccountStatus, StaffListItem } from '@/features/staff/data/types';
import type { TableState } from '@/services/pagination';

/**
 * A user IS a staff member with an account — there is no separate resource and
 * no separate endpoint, only `GET /api/staff?hasAccount=true`. So the row shape
 * is the staff row, reused rather than re-declared: one wire contract, one
 * place to change it.
 *
 * The one narrowing: `StaffListItem.status` is `AccountStatus | null`, and the
 * `null` means "no account". Every row here has one by construction, so the
 * column and the row actions can read it without a null branch that could
 * never fire.
 */
export type UserListItem = StaffListItem & { status: AccountStatus };

export type UserTableState = TableState;

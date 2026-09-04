import type { TableState } from '@/services/pagination';

export type EmploymentStatus = 'active' | 'on_leave' | 'terminated';

/** `branch` confines every query to the staff member's branch. */
export type DataScope = 'branch' | 'all';
export type UserStatus = 'active' | 'suspended' | 'deactivated';
export type Gender = 'male' | 'female';

/** The identifier is the user id — staff_profiles is keyed by it. */
export interface StaffListItem {
  userId: string;
  staffCode: string;
  jobTitle: string;
  employmentStatus: EmploymentStatus;
  dataScope: DataScope;
  hiredOn: string;
  firstName: string;
  lastName: string;
  phone: string;
  status: UserStatus;
  branchId: string;
  branchName: string;
  createdAt: string;
  roles: { id: string; name: string }[];
}

export interface StaffDetail extends StaffListItem {
  terminatedOn: string | null;
  dateOfBirth: string | null;
  gender: Gender | null;
  lastLoginAt: string | null;
  updatedAt: string;
}

export type StaffTableState = TableState;

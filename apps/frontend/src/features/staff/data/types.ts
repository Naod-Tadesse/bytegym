import type { TableState } from '@/services/pagination';

export type EmploymentStatus = 'active' | 'on_leave' | 'terminated';
export type UserStatus = 'active' | 'suspended' | 'deactivated';
export type Gender = 'male' | 'female';

/** The identifier is the user id — staff_profiles is keyed by it. */
export interface StaffListItem {
  userId: string;
  staffCode: string;
  jobTitle: string;
  employmentStatus: EmploymentStatus;
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

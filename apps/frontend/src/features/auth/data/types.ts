/** Shape returned by GET /api/auth/me. */
export interface AuthUser {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  status: 'active' | 'suspended' | 'deactivated';
  staffCode: string;
  jobTitle: string;
  employmentStatus: 'active' | 'on_leave' | 'terminated';
  /** `branch` hides everything cross-branch in the UI. */
  dataScope: 'branch' | 'all';
  branchId: string;
  branchName: string;
  roles: string[];
  permissions: string[];
}

export interface LoginRequest {
  phone: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

import { useCurrentUser } from './use-auth';

/**
 * Permissions are a field on /auth/me, read live rather than decoded from the
 * token — so a revoked permission disappears from the UI before the access
 * token expires.
 */
export function usePermissions() {
  const { data: user } = useCurrentUser();
  const permissions = user?.permissions ?? [];

  return {
    permissions,
    hasPermission: (permission: string) => permissions.includes(permission),
    hasAnyPermission: (required: string[]) =>
      required.length === 0 ||
      required.some((permission) => permissions.includes(permission)),
    hasAllPermissions: (required: string[]) =>
      required.every((permission) => permissions.includes(permission)),
  };
}

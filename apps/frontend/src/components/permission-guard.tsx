import { useEffect, type ReactNode } from 'react';
import { useNavigate } from '@tanstack/react-router';

import { useAuthStore } from '@/features/auth/context/auth-store';
import { usePermissions } from '@/features/auth/hooks/use-permissions';

/**
 * Route-level gate. The API enforces the same permission server-side — this
 * only stops the UI showing a page the user cannot use.
 */
export function PermissionGuard({
  permission,
  children,
}: {
  permission: string;
  children: ReactNode;
}) {
  const accessToken = useAuthStore((state) => state.accessToken);
  const { hasPermission } = usePermissions();
  const navigate = useNavigate();
  const allowed = hasPermission(permission);

  useEffect(() => {
    // No token at all is __root's problem, not ours.
    if (!accessToken) return;
    if (!allowed) navigate({ to: '/' });
  }, [accessToken, allowed, navigate]);

  if (!accessToken || !allowed) return null;
  return children;
}

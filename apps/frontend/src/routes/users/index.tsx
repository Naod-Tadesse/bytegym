import { createFileRoute } from '@tanstack/react-router';

import { PermissionGuard } from '@/components/permission-guard';
import { Users } from '@/features/users';

export const Route = createFileRoute('/users/')({
  component: () => (
    <PermissionGuard permission="user.list">
      <Users />
    </PermissionGuard>
  ),
});

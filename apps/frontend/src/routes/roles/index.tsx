import { createFileRoute } from '@tanstack/react-router';

import { PermissionGuard } from '@/components/permission-guard';
import { Roles } from '@/features/roles';

export const Route = createFileRoute('/roles/')({
  component: () => (
    <PermissionGuard permission="role.list">
      <Roles />
    </PermissionGuard>
  ),
});

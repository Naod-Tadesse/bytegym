import { createFileRoute } from '@tanstack/react-router';

import { PermissionGuard } from '@/components/permission-guard';
import { Staff } from '@/features/staff';

export const Route = createFileRoute('/staff/')({
  component: () => (
    <PermissionGuard permission="staff.list">
      <Staff />
    </PermissionGuard>
  ),
});

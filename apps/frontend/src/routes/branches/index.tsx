import { createFileRoute } from '@tanstack/react-router';

import { PermissionGuard } from '@/components/permission-guard';
import { Branches } from '@/features/branches';

export const Route = createFileRoute('/branches/')({
  component: () => (
    <PermissionGuard permission="branch.list">
      <Branches />
    </PermissionGuard>
  ),
});

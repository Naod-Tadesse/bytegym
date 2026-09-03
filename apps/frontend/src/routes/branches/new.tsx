import { createFileRoute } from '@tanstack/react-router';

import { PermissionGuard } from '@/components/permission-guard';
import { CreateBranch } from '@/features/branches/pages/create-branch';

export const Route = createFileRoute('/branches/new')({
  component: () => (
    <PermissionGuard permission="branch.create">
      <CreateBranch />
    </PermissionGuard>
  ),
});

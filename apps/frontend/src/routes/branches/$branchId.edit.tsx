import { createFileRoute } from '@tanstack/react-router';

import { PermissionGuard } from '@/components/permission-guard';
import { EditBranch } from '@/features/branches/pages/edit-branch';

function EditBranchRoute() {
  const { branchId } = Route.useParams();

  return (
    <PermissionGuard permission="branch.update">
      <EditBranch branchId={branchId} />
    </PermissionGuard>
  );
}

export const Route = createFileRoute('/branches/$branchId/edit')({
  component: EditBranchRoute,
});

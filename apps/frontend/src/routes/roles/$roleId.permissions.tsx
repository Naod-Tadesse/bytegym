import { createFileRoute } from '@tanstack/react-router';

import { PermissionGuard } from '@/components/permission-guard';
import { ManageRolePermissions } from '@/features/roles/pages/manage-permissions';

function ManagePermissionsRoute() {
  const { roleId } = Route.useParams();

  return (
    <PermissionGuard permission="role.assign">
      <ManageRolePermissions roleId={roleId} />
    </PermissionGuard>
  );
}

export const Route = createFileRoute('/roles/$roleId/permissions')({
  component: ManagePermissionsRoute,
});

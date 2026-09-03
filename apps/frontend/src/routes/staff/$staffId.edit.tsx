import { createFileRoute } from '@tanstack/react-router';

import { PermissionGuard } from '@/components/permission-guard';
import { EditStaff } from '@/features/staff/pages/edit-staff';

function EditStaffRoute() {
  const { staffId } = Route.useParams();

  return (
    <PermissionGuard permission="staff.update">
      <EditStaff staffId={staffId} />
    </PermissionGuard>
  );
}

export const Route = createFileRoute('/staff/$staffId/edit')({
  component: EditStaffRoute,
});

import { createFileRoute } from '@tanstack/react-router';

import { PermissionGuard } from '@/components/permission-guard';
import { StaffDetail } from '@/features/staff/pages/staff-detail';

function StaffDetailRoute() {
  const { staffId } = Route.useParams();

  return (
    <PermissionGuard permission="staff.read">
      <StaffDetail staffId={staffId} />
    </PermissionGuard>
  );
}

export const Route = createFileRoute('/staff/$staffId/')({
  component: StaffDetailRoute,
});

import { createFileRoute } from '@tanstack/react-router';

import { PermissionGuard } from '@/components/permission-guard';
import { CreateStaff } from '@/features/staff/pages/create-staff';

export const Route = createFileRoute('/staff/new')({
  component: () => (
    <PermissionGuard permission="staff.create">
      <CreateStaff />
    </PermissionGuard>
  ),
});

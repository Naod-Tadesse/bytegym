import { createFileRoute } from '@tanstack/react-router';

import { PermissionGuard } from '@/components/permission-guard';
import { Attendance } from '@/features/attendance';

export const Route = createFileRoute('/attendance/')({
  component: () => (
    // The same permission the endpoint enforces: reading the register is
    // `checkin.list`, exactly as reading the desk's day is. Recording a visit
    // is `checkin.record` and lives on the other screen — there is nothing on
    // this one to gate separately, because there is nothing on it to do.
    <PermissionGuard permission="checkin.list">
      <Attendance />
    </PermissionGuard>
  ),
});

import { createFileRoute } from '@tanstack/react-router';

import { PermissionGuard } from '@/components/permission-guard';
import { CheckIns } from '@/features/check-ins';

export const Route = createFileRoute('/check-ins/')({
  component: () => (
    // `checkin.list` gates the screen; `checkin.record` gates the button on it,
    // so a manager who may read the day's attendance but not admit anyone gets
    // the page without the control.
    <PermissionGuard permission="checkin.list">
      <CheckIns />
    </PermissionGuard>
  ),
});

import { createFileRoute } from '@tanstack/react-router';

import { PermissionGuard } from '@/components/permission-guard';
import { Payments } from '@/features/payments';

export const Route = createFileRoute('/payments/')({
  component: () => (
    <PermissionGuard permission="payment.list">
      <Payments />
    </PermissionGuard>
  ),
});

import { createFileRoute } from '@tanstack/react-router';

import { PermissionGuard } from '@/components/permission-guard';
import { MembershipPlans } from '@/features/membership-plans';

export const Route = createFileRoute('/membership-plans/')({
  component: () => (
    <PermissionGuard permission="plan.list">
      <MembershipPlans />
    </PermissionGuard>
  ),
});

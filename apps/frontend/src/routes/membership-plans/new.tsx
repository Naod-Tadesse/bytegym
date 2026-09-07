import { createFileRoute } from '@tanstack/react-router';

import { PermissionGuard } from '@/components/permission-guard';
import { CreateMembershipPlan } from '@/features/membership-plans/pages/create-membership-plan';

export const Route = createFileRoute('/membership-plans/new')({
  component: () => (
    <PermissionGuard permission="plan.create">
      <CreateMembershipPlan />
    </PermissionGuard>
  ),
});

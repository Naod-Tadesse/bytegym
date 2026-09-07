import { createFileRoute } from '@tanstack/react-router';

import { PermissionGuard } from '@/components/permission-guard';
import { EditMembershipPlan } from '@/features/membership-plans/pages/edit-membership-plan';

function EditMembershipPlanRoute() {
  const { planId } = Route.useParams();

  return (
    <PermissionGuard permission="plan.update">
      <EditMembershipPlan planId={planId} />
    </PermissionGuard>
  );
}

export const Route = createFileRoute('/membership-plans/$planId/edit')({
  component: EditMembershipPlanRoute,
});

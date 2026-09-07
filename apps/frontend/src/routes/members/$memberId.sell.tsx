import { createFileRoute } from '@tanstack/react-router';

import { PermissionGuard } from '@/components/permission-guard';
import { SellMembership } from '@/features/members/pages/sell-membership';

function SellMembershipRoute() {
  const { memberId } = Route.useParams();

  return (
    <PermissionGuard permission="membership.sell">
      <SellMembership memberId={memberId} />
    </PermissionGuard>
  );
}

export const Route = createFileRoute('/members/$memberId/sell')({
  component: SellMembershipRoute,
});

import { createFileRoute } from '@tanstack/react-router';

import { PermissionGuard } from '@/components/permission-guard';
import { MemberDetail } from '@/features/members/pages/member-detail';

function MemberDetailRoute() {
  const { memberId } = Route.useParams();

  return (
    <PermissionGuard permission="member.read">
      <MemberDetail memberId={memberId} />
    </PermissionGuard>
  );
}

export const Route = createFileRoute('/members/$memberId/')({
  component: MemberDetailRoute,
});

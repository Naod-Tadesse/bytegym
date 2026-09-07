import { createFileRoute } from '@tanstack/react-router';

import { PermissionGuard } from '@/components/permission-guard';
import { EditMember } from '@/features/members/pages/edit-member';

function EditMemberRoute() {
  const { memberId } = Route.useParams();

  return (
    <PermissionGuard permission="member.update">
      <EditMember memberId={memberId} />
    </PermissionGuard>
  );
}

export const Route = createFileRoute('/members/$memberId/edit')({
  component: EditMemberRoute,
});

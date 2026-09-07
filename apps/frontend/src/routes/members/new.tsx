import { createFileRoute } from '@tanstack/react-router';

import { PermissionGuard } from '@/components/permission-guard';
import { CreateMember } from '@/features/members/pages/create-member';

export const Route = createFileRoute('/members/new')({
  component: () => (
    <PermissionGuard permission="member.create">
      <CreateMember />
    </PermissionGuard>
  ),
});

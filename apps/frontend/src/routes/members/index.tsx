import { createFileRoute } from '@tanstack/react-router';

import { PermissionGuard } from '@/components/permission-guard';
import { Members } from '@/features/members';

export const Route = createFileRoute('/members/')({
  component: () => (
    <PermissionGuard permission="member.list">
      <Members />
    </PermissionGuard>
  ),
});

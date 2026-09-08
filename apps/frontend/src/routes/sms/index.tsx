import { createFileRoute } from '@tanstack/react-router';

import { PermissionGuard } from '@/components/permission-guard';
import { Sms } from '@/features/sms';

function SmsRoute() {
  // The screen's weakest permission: someone who may only read the log still
  // has a page worth opening. The cards inside gate themselves.
  return (
    <PermissionGuard permission="sms.list">
      <Sms />
    </PermissionGuard>
  );
}

export const Route = createFileRoute('/sms/')({
  component: SmsRoute,
});

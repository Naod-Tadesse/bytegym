import { createFileRoute } from '@tanstack/react-router';

import { DashboardPage } from '@/features/dashboard';

// No PermissionGuard: this is the landing route, and a guard here would
// redirect to itself. The figures are gated inside the page instead.
export const Route = createFileRoute('/')({
  component: DashboardPage,
});

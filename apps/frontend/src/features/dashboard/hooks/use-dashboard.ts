import { useQuery } from '@tanstack/react-query';

import ApiClient from '@/services/api-client';
import type { Dashboard } from '../data/types';

// The hooks file IS the api layer — no separate api/ folder.
const apiClient = new ApiClient('/api/reports');

/**
 * The dashboard's figures, aggregated by the server.
 *
 * `enabled` rather than an unconditional fetch: the endpoint requires
 * `report.view`, and the dashboard is the landing route, so a caller without it
 * would be greeted by a 403 toast on every single sign-in.
 */
export function useDashboard(enabled = true) {
  const query = useQuery({
    queryKey: ['reports', 'dashboard'],
    queryFn: () => apiClient.get<Dashboard>('/dashboard'),
    enabled,
  });

  return {
    dashboard: query.data,
    isLoading: query.isLoading,
  };
}

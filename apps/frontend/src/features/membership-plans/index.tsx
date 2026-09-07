import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';
import { HugeiconsIcon } from '@hugeicons/react';
import { Add01Icon } from '@hugeicons/core-free-icons';

import { ListPage } from '@/components/list-page';
import { DataTable } from '@/components/table/data-table';
import { Button } from '@/components/ui/button';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { useDebounce } from '@/hooks/use-debounce';
import { useMembershipPlanColumns } from './components/membership-plan-columns';
import { MembershipPlanProvider } from './context/membership-plan-context';
import { MembershipPlanDialogs } from './context/membership-plan-dialogs';
import type { MembershipPlanTableState } from './data/types';
import { useMembershipPlans } from './hooks/use-membership-plans';

function MembershipPlansContent() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();

  const [tableState, setTableState] = useState<MembershipPlanTableState>({
    page: 1,
    limit: 10,
    search: '',
  });
  const columns = useMembershipPlanColumns(tableState);
  const search = useDebounce(tableState.search);

  // The debounced term is what the server sees; the input stays instant.
  const { plans, isLoading, paginationInfo } = useMembershipPlans({
    ...tableState,
    search,
  });

  return (
    <>
      <ListPage
        title={t('plans.title')}
        subtitle={t('plans.subtitle')}
        headerActions={
          hasPermission('plan.create') && (
            <Button onClick={() => navigate({ to: '/membership-plans/new' })}>
              <HugeiconsIcon icon={Add01Icon} data-icon="inline-start" />
              {t('plans.actions.create')}
            </Button>
          )
        }
      >
        <DataTable
          columns={columns}
          data={plans}
          tableState={tableState}
          setTableState={setTableState}
          isLoading={isLoading}
          searchPlaceholder={t('plans.actions.search')}
          paginationInfo={paginationInfo}
        />
      </ListPage>
      <MembershipPlanDialogs />
    </>
  );
}

export function MembershipPlans() {
  return (
    <MembershipPlanProvider>
      <MembershipPlansContent />
    </MembershipPlanProvider>
  );
}

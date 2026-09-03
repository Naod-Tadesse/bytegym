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
import { useStaffColumns } from './components/staff-columns';
import { StaffProvider } from './context/staff-context';
import { StaffDialogs } from './context/staff-dialogs';
import type { StaffTableState } from './data/types';
import { useStaffList } from './hooks/use-staff';

function StaffContent() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();

  const [tableState, setTableState] = useState<StaffTableState>({
    page: 1,
    limit: 10,
    search: '',
  });
  const columns = useStaffColumns(tableState);
  const search = useDebounce(tableState.search);

  const { staff, isLoading, paginationInfo } = useStaffList({
    ...tableState,
    search,
  });

  const canRead = hasPermission('staff.read');

  return (
    <>
      <ListPage
        title={t('staff.title')}
        subtitle={t('staff.subtitle')}
        headerActions={
          hasPermission('staff.create') && (
            <Button onClick={() => navigate({ to: '/staff/new' })}>
              <HugeiconsIcon icon={Add01Icon} data-icon="inline-start" />
              {t('staff.actions.create')}
            </Button>
          )
        }
      >
        <DataTable
          columns={columns}
          data={staff}
          tableState={tableState}
          setTableState={setTableState}
          isLoading={isLoading}
          searchPlaceholder={t('staff.actions.search')}
          paginationInfo={paginationInfo}
          // Only offer the row as a link when the detail page is reachable.
          onRowClick={
            canRead
              ? (row) =>
                  navigate({
                    to: '/staff/$staffId',
                    params: { staffId: row.userId },
                  })
              : undefined
          }
        />
      </ListPage>
      <StaffDialogs />
    </>
  );
}

export function Staff() {
  return (
    <StaffProvider>
      <StaffContent />
    </StaffProvider>
  );
}

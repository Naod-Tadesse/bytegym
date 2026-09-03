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
import { useBranchColumns } from './components/branch-columns';
import { BranchProvider } from './context/branch-context';
import { BranchDialogs } from './context/branch-dialogs';
import type { BranchTableState } from './data/types';
import { useBranches } from './hooks/use-branches';

function BranchesContent() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();

  const [tableState, setTableState] = useState<BranchTableState>({
    page: 1,
    limit: 10,
    search: '',
  });
  const columns = useBranchColumns(tableState);
  const search = useDebounce(tableState.search);

  // The debounced term is what the server sees; the input stays instant.
  const { branches, isLoading, paginationInfo } = useBranches({
    ...tableState,
    search,
  });

  return (
    <>
      <ListPage
        title={t('branches.title')}
        subtitle={t('branches.subtitle')}
        headerActions={
          hasPermission('branch.create') && (
            <Button onClick={() => navigate({ to: '/branches/new' })}>
              <HugeiconsIcon icon={Add01Icon} data-icon="inline-start" />
              {t('branches.actions.create')}
            </Button>
          )
        }
      >
        <DataTable
          columns={columns}
          data={branches}
          tableState={tableState}
          setTableState={setTableState}
          isLoading={isLoading}
          searchPlaceholder={t('branches.actions.search')}
          paginationInfo={paginationInfo}
        />
      </ListPage>
      <BranchDialogs />
    </>
  );
}

export function Branches() {
  return (
    <BranchProvider>
      <BranchesContent />
    </BranchProvider>
  );
}

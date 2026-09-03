import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { HugeiconsIcon } from '@hugeicons/react';
import { Add01Icon } from '@hugeicons/core-free-icons';

import { ListPage } from '@/components/list-page';
import { DataTable } from '@/components/table/data-table';
import { Button } from '@/components/ui/button';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { useDebounce } from '@/hooks/use-debounce';
import { useRoleColumns } from './components/role-columns';
import { RoleProvider, useRoleContext } from './context/role-context';
import { RoleDialogs } from './context/role-dialogs';
import type { RoleTableState } from './data/types';
import { useRoles } from './hooks/use-roles';

function RolesContent() {
  const { t } = useTranslation();
  const { hasPermission } = usePermissions();
  const { setOpen } = useRoleContext();

  const [tableState, setTableState] = useState<RoleTableState>({
    page: 1,
    limit: 10,
    search: '',
  });
  const columns = useRoleColumns(tableState);
  const search = useDebounce(tableState.search);

  const { roles, isLoading, paginationInfo } = useRoles({
    ...tableState,
    search,
  });

  return (
    <>
      <ListPage
        title={t('roles.title')}
        subtitle={t('roles.subtitle')}
        headerActions={
          hasPermission('role.create') && (
            <Button onClick={() => setOpen('create')}>
              <HugeiconsIcon icon={Add01Icon} data-icon="inline-start" />
              {t('roles.actions.create')}
            </Button>
          )
        }
      >
        <DataTable
          columns={columns}
          data={roles}
          tableState={tableState}
          setTableState={setTableState}
          isLoading={isLoading}
          searchPlaceholder={t('roles.actions.search')}
          paginationInfo={paginationInfo}
        />
      </ListPage>
      <RoleDialogs />
    </>
  );
}

export function Roles() {
  return (
    <RoleProvider>
      <RolesContent />
    </RoleProvider>
  );
}

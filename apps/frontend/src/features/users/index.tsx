import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ListPage } from '@/components/list-page';
import { DataTable } from '@/components/table/data-table';
import { useDebounce } from '@/hooks/use-debounce';
import { useUserColumns } from './components/user-columns';
import { UserProvider } from './context/user-context';
import { UserDialogs } from './context/user-dialogs';
import type { UserTableState } from './data/types';
import { useUsers } from './hooks/use-users';

function UsersContent() {
  const { t } = useTranslation();

  const [tableState, setTableState] = useState<UserTableState>({
    page: 1,
    limit: 10,
    search: '',
  });
  const columns = useUserColumns(tableState);
  const search = useDebounce(tableState.search);

  // The debounced term is what the server sees; the input stays instant.
  const { users, isLoading, paginationInfo } = useUsers({
    ...tableState,
    search,
  });

  return (
    <>
      <ListPage
        title={t('users.title')}
        subtitle={t('users.subtitle')}
      >
        <DataTable
          columns={columns}
          data={users}
          tableState={tableState}
          setTableState={setTableState}
          isLoading={isLoading}
          searchPlaceholder={t('users.actions.search')}
          paginationInfo={paginationInfo}
        />
      </ListPage>
      <UserDialogs />
    </>
  );
}

export function Users() {
  return (
    <UserProvider>
      <UsersContent />
    </UserProvider>
  );
}

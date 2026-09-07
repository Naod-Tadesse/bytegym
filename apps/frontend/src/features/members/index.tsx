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
import { useMemberColumns } from './components/member-columns';
import { MemberProvider } from './context/member-context';
import { MemberDialogs } from './context/member-dialogs';
import type { MemberTableState } from './data/types';
import { useMembers } from './hooks/use-members';

function MembersContent() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();

  const [tableState, setTableState] = useState<MemberTableState>({
    page: 1,
    limit: 10,
    search: '',
  });
  const columns = useMemberColumns(tableState);
  const search = useDebounce(tableState.search);

  // The debounced term is what the server sees; the input stays instant.
  const { members, isLoading, paginationInfo } = useMembers({
    ...tableState,
    search,
  });

  const canRead = hasPermission('member.read');

  return (
    <>
      <ListPage
        title={t('members.title')}
        subtitle={t('members.subtitle')}
        headerActions={
          hasPermission('member.create') && (
            <Button onClick={() => navigate({ to: '/members/new' })}>
              <HugeiconsIcon icon={Add01Icon} data-icon="inline-start" />
              {t('members.actions.create')}
            </Button>
          )
        }
      >
        <DataTable
          columns={columns}
          data={members}
          tableState={tableState}
          setTableState={setTableState}
          isLoading={isLoading}
          searchPlaceholder={t('members.actions.search')}
          paginationInfo={paginationInfo}
          // Only offer the row as a link when the detail page is reachable.
          onRowClick={
            canRead
              ? (row) =>
                  navigate({
                    to: '/members/$memberId',
                    params: { memberId: row.personId },
                  })
              : undefined
          }
        />
      </ListPage>
      <MemberDialogs />
    </>
  );
}

export function Members() {
  return (
    <MemberProvider>
      <MembersContent />
    </MemberProvider>
  );
}

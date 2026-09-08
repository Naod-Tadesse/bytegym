import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ListPage } from '@/components/list-page';
import { DataTable } from '@/components/table/data-table';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { BroadcastCard } from './components/broadcast-card';
import { RemindersCard } from './components/reminders-card';
import { SendCard } from './components/send-card';
import {
  useSmsKindOptions,
  useSmsStatusOptions,
} from './components/sms-badges';
import { useSmsColumns } from './components/sms-columns';
import type { SmsTableState } from './data/types';
import { useSmsMessages } from './hooks/use-sms';

/**
 * Everything the gym says to its members, in one screen.
 *
 * Cards rather than tabs: the three things you can do here are short, and a
 * receptionist sending a new year wish should not have to know which tab it
 * lives under. The history sits beneath them because it is the answer to
 * "did that work" for all three.
 *
 * Each card is gated on its own permission — they are three different sizes of
 * mistake, which is why the API gates them apart too.
 */
function SmsContent() {
  const { t } = useTranslation();
  const { hasPermission } = usePermissions();

  const [tableState, setTableState] = useState<SmsTableState>({
    page: 1,
    limit: 10,
  });
  const columns = useSmsColumns(tableState);
  const { messages, isLoading, paginationInfo } = useSmsMessages(tableState);

  const kindOptions = useSmsKindOptions();
  const statusOptions = useSmsStatusOptions();

  return (
    <ListPage title={t('sms.title')} subtitle={t('sms.subtitle')}>
      <div className="flex flex-col gap-4">
        {hasPermission('sms.send') && <SendCard />}
        {hasPermission('sms.broadcast') && <BroadcastCard />}
        {hasPermission('sms.settings') && <RemindersCard />}

        {/* Its own permission, so the query is never even issued without it —
            a 403 here would toast an error on a page the caller may otherwise
            use perfectly well. */}
        {hasPermission('sms.list') && (
          <DataTable
            columns={columns}
            data={messages}
            tableState={tableState}
            setTableState={setTableState}
            isLoading={isLoading}
            paginationInfo={paginationInfo}
            searchPlaceholder={t('sms.actions.search')}
            filters={[
              {
                field: 'kind',
                title: t('sms.columns.kind'),
                options: kindOptions,
              },
              {
                field: 'status',
                title: t('sms.columns.status'),
                options: statusOptions,
              },
            ]}
          />
        )}
      </div>
    </ListPage>
  );
}

export function Sms() {
  return <SmsContent />;
}

import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ListPage } from '@/components/list-page';
import { DataTable } from '@/components/table/data-table';
import { formatBirr } from '@/lib/format';
import { usePaymentColumns } from './components/payment-columns';
import { DateRangeFilter } from './components/date-range-filter';
import { PaymentProvider } from './context/payment-context';
import { PaymentDialogs } from './context/payment-dialogs';
import type { PaymentTableState } from './data/types';
import { usePayments } from './hooks/use-payments';

function PaymentsContent() {
  const { t } = useTranslation();

  const [tableState, setTableState] = useState<PaymentTableState>({
    page: 1,
    limit: 10,
  });
  const columns = usePaymentColumns(tableState);

  const { payments, totalReceived, isLoading, paginationInfo } =
    usePayments(tableState);

  return (
    <>
      <ListPage
        title={t('payments.title')}
        subtitle={t('payments.subtitle')}
        headerActions={
          // The figure a receptionist counts the drawer against, so it is the
          // server's SUM() over the whole filter — never the page's rows added
          // up here, which would be one page of many and string arithmetic
          // besides.
          <span className="text-sm text-muted-foreground">
            {t('payments.totalReceived', { total: formatBirr(totalReceived) })}
          </span>
        }
      >
        <DataTable
          columns={columns}
          data={payments}
          tableState={tableState}
          setTableState={setTableState}
          isLoading={isLoading}
          paginationInfo={paginationInfo}
          // The endpoint filters by member, membership, branch and date — it
          // takes no search term, so the box is hidden rather than offered as
          // a control that quietly does nothing.
          hideSearch
        >
          <DateRangeFilter
            value={{ from: tableState.from, to: tableState.to }}
            // Back to page 1: page 4 of an unfiltered week is very unlikely to
            // exist once a single day is selected.
            onChange={(range) =>
              setTableState((previous) => ({ ...previous, ...range, page: 1 }))
            }
          />
        </DataTable>
      </ListPage>
      <PaymentDialogs />
    </>
  );
}

export function Payments() {
  return (
    <PaymentProvider>
      <PaymentsContent />
    </PaymentProvider>
  );
}

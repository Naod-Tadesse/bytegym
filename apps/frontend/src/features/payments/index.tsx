import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { ListPage } from '@/components/list-page';
import { DataTable } from '@/components/table/data-table';
import { useAllPlanOptions } from '@/features/membership-plans/hooks/use-membership-plans';
import { formatBirr } from '@/lib/format';
import { usePaymentMethodOptions } from './components/payment-badges';
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

  // A closed enum written in code, so a plain option list is right.
  const methodOptions = usePaymentMethodOptions();
  // Every plan, retired ones included — see useAllPlanOptions.
  const planOptions = useAllPlanOptions();

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
          // A payment carries no text of its own, so the term matches the
          // person who made it — name, phone or member code.
          searchPlaceholder={t('payments.actions.search')}
          filters={[
            {
              field: 'planId',
              title: t('payments.filters.plan'),
              options: planOptions,
            },
            {
              field: 'method',
              title: t('payments.filters.method'),
              options: methodOptions,
            },
          ]}
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

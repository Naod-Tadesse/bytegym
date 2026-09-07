import { useMemo } from 'react';
import { createColumnHelper } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';

import { DataTableColumnHeader } from '@/components/table/column-header';
import type { DataTableFeatures } from '@/components/table/data-table-features';
import { rowNumberColumn } from '@/components/table/row-number-column';
import { useCurrentUser } from '@/features/auth/hooks/use-auth';
import { formatDate } from '@/lib/format';
import type { Payment } from '../data/types';
import { PaymentRowActions } from './data-table-row-actions';
import { PaymentAmount } from './payment-amount';
import { PaymentMethodBadge } from './payment-badges';

const columnHelper = createColumnHelper<DataTableFeatures, Payment>();

export function usePaymentColumns({
  page,
  limit,
}: {
  page: number;
  limit: number;
}) {
  const { t } = useTranslation();
  const { data: currentUser } = useCurrentUser();
  // At `branch` scope every row is the caller's own branch, so the column
  // would repeat one value down the page.
  const showBranch = currentUser?.dataScope === 'all';

  return useMemo(
    () =>
      columnHelper
        .columns([
          rowNumberColumn(columnHelper, { page, limit }),
          columnHelper.accessor('receivedAt', {
            header: ({ column }) => (
              <DataTableColumnHeader
                column={column}
                title={t('payments.columns.date')}
              />
            ),
            cell: ({ row }) => (
              <span className="whitespace-nowrap text-muted-foreground">
                {formatDate(row.original.receivedAt)}
              </span>
            ),
          }),
          columnHelper.accessor('memberName', {
            header: ({ column }) => (
              <DataTableColumnHeader
                column={column}
                title={t('payments.columns.member')}
              />
            ),
            cell: ({ row }) => (
              <span className="font-medium">{row.original.memberName}</span>
            ),
          }),
          columnHelper.accessor('method', {
            header: ({ column }) => (
              <DataTableColumnHeader
                column={column}
                title={t('payments.columns.method')}
              />
            ),
            cell: ({ row }) => (
              <PaymentMethodBadge method={row.original.method} />
            ),
          }),
          // Struck through and badged when voided, never dropped from the list:
          // a reconciliation has to account for the cancellation, and only
          // `totals.received` leaves it out.
          columnHelper.accessor('amount', {
            header: ({ column }) => (
              <DataTableColumnHeader
                column={column}
                title={t('payments.columns.amount')}
              />
            ),
            cell: ({ row }) => <PaymentAmount payment={row.original} />,
          }),
          columnHelper.accessor('branchName', {
            id: 'branchName',
            header: ({ column }) => (
              <DataTableColumnHeader
                column={column}
                title={t('payments.columns.branch')}
              />
            ),
            cell: ({ row }) => (
              <span className="text-muted-foreground">
                {row.original.branchName}
              </span>
            ),
          }),
          columnHelper.accessor('receivedByName', {
            header: ({ column }) => (
              <DataTableColumnHeader
                column={column}
                title={t('payments.columns.receivedBy')}
              />
            ),
            cell: ({ row }) => (
              <span className="text-muted-foreground">
                {row.original.receivedByName ?? '—'}
              </span>
            ),
          }),
          // No width class and no centering: constraining this column strands
          // the button at the far right of the table.
          columnHelper.display({
            id: 'actions',
            enableHiding: false,
            enableSorting: false,
            cell: ({ row }) => <PaymentRowActions payment={row.original} />,
          }),
        ])
        .filter((column) => showBranch || column.id !== 'branchName'),
    [t, page, limit, showBranch],
  );
}

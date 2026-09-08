import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { createColumnHelper } from '@tanstack/react-table';

import { DataTableColumnHeader } from '@/components/table/column-header';
import type { DataTableFeatures } from '@/components/table/data-table-features';
import { rowNumberColumn } from '@/components/table/row-number-column';
import { CopyableText } from '@/components/ui/copy-button';
import { formatDate } from '@/lib/format';
import { formatGymTime } from '@/lib/gym-day';
import type { SmsMessage, SmsTableState } from '../data/types';
import { SmsKindBadge, SmsStatusBadge } from './sms-badges';

const columnHelper = createColumnHelper<DataTableFeatures, SmsMessage>();

/** A factory, not a constant: the row number depends on the current page. */
export function useSmsColumns(tableState: SmsTableState) {
  const { t } = useTranslation();

  return useMemo(
    () =>
      columnHelper.columns([
        rowNumberColumn(columnHelper, tableState),
        columnHelper.accessor('createdAt', {
          header: ({ column }) => (
            <DataTableColumnHeader
              column={column}
              title={t('sms.columns.when')}
            />
          ),
          cell: ({ row }) => (
            <span className="flex flex-col gap-0.5 whitespace-nowrap tabular-nums">
              <span>{formatDate(row.original.sentOn)}</span>
              {/* The gym's clock, not the browser's — same rule as the day. */}
              <span className="text-xs text-muted-foreground">
                {formatGymTime(row.original.createdAt)}
              </span>
            </span>
          ),
        }),
        columnHelper.accessor('phone', {
          header: ({ column }) => (
            <DataTableColumnHeader
              column={column}
              title={t('sms.columns.to')}
            />
          ),
          cell: ({ row }) => (
            <span className="flex flex-col gap-0.5">
              {/* Stated either way: a number belonging to no member is a real
                  case here, not missing data. */}
              <span className="font-medium">
                {row.original.memberName ?? t('sms.notAMember')}
              </span>
              <CopyableText
                value={row.original.phone}
                label={t('sms.copyPhone')}
                className="text-xs tabular-nums text-muted-foreground"
              />
            </span>
          ),
        }),
        columnHelper.accessor('body', {
          header: ({ column }) => (
            <DataTableColumnHeader
              column={column}
              title={t('sms.columns.message')}
            />
          ),
          cell: ({ row }) => (
            <span className="block max-w-md text-muted-foreground">
              {row.original.body}
            </span>
          ),
        }),
        columnHelper.accessor('kind', {
          header: ({ column }) => (
            <DataTableColumnHeader
              column={column}
              title={t('sms.columns.kind')}
            />
          ),
          cell: ({ row }) => <SmsKindBadge kind={row.original.kind} />,
        }),
        columnHelper.accessor('status', {
          header: ({ column }) => (
            <DataTableColumnHeader
              column={column}
              title={t('sms.columns.status')}
            />
          ),
          cell: ({ row }) => (
            <span className="flex flex-col gap-1">
              <SmsStatusBadge status={row.original.status} />
              {/* The provider's complaint, under the badge that summarises it.
                  Without this a failed row says nothing actionable. */}
              {row.original.error && row.original.status === 'failed' && (
                <span className="text-xs text-muted-foreground">
                  {row.original.error}
                </span>
              )}
            </span>
          ),
        }),
      ]),
    [t, tableState],
  );
}

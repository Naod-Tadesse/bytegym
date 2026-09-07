import { useMemo } from 'react';
import { createColumnHelper } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';

import { DataTableColumnHeader } from '@/components/table/column-header';
import type { DataTableFeatures } from '@/components/table/data-table-features';
import { rowNumberColumn } from '@/components/table/row-number-column';
import { Badge } from '@/components/ui/badge';
import { formatBirr, isZeroAmount } from '@/lib/format';
import type { MembershipPlan } from '../data/types';
import { MembershipPlanRowActions } from './data-table-row-actions';

const columnHelper = createColumnHelper<DataTableFeatures, MembershipPlan>();

export function useMembershipPlanColumns({
  page,
  limit,
}: {
  page: number;
  limit: number;
}) {
  const { t } = useTranslation();

  return useMemo(
    () =>
      columnHelper.columns([
        rowNumberColumn(columnHelper, { page, limit }),
        columnHelper.accessor('name', {
          header: ({ column }) => (
            <DataTableColumnHeader
              column={column}
              title={t('plans.columns.name')}
            />
          ),
          cell: ({ row }) => (
            <div className="flex flex-col">
              <span className="font-medium">{row.original.name}</span>
              {row.original.description && (
                <span className="text-xs text-muted-foreground">
                  {row.original.description}
                </span>
              )}
            </div>
          ),
        }),
        columnHelper.accessor('durationDays', {
          header: ({ column }) => (
            <DataTableColumnHeader
              column={column}
              title={t('plans.columns.duration')}
            />
          ),
          cell: ({ row }) => (
            <span className="tabular-nums text-muted-foreground">
              {t('plans.duration', { count: row.original.durationDays })}
            </span>
          ),
        }),
        columnHelper.accessor('price', {
          header: ({ column }) => (
            <DataTableColumnHeader
              column={column}
              title={t('plans.columns.price')}
            />
          ),
          // `tabular-nums` matters on a money column: without it the digits
          // shift width and a column of amounts will not line up. The string
          // goes straight to `formatBirr` — it is never parsed anywhere else.
          cell: ({ row }) => (
            <span className="tabular-nums font-medium">
              {formatBirr(row.original.price)}
            </span>
          ),
        }),
        // Beside the price, because the two together are what a first-time
        // buyer is quoted — and apart, because the fee is charged once and the
        // price every renewal.
        columnHelper.accessor('registrationFee', {
          header: ({ column }) => (
            <DataTableColumnHeader
              column={column}
              title={t('plans.columns.registrationFee')}
            />
          ),
          // "None" rather than `0.00 ETB`: a zero rendered as money reads as a
          // fee someone forgot to fill in, and most plans carry none.
          cell: ({ row }) =>
            isZeroAmount(row.original.registrationFee) ? (
              <span className="text-muted-foreground">
                {t('plans.noRegistrationFee')}
              </span>
            ) : (
              <span className="tabular-nums">
                {formatBirr(row.original.registrationFee)}
              </span>
            ),
        }),
        columnHelper.accessor('isActive', {
          header: ({ column }) => (
            <DataTableColumnHeader
              column={column}
              title={t('plans.columns.status')}
            />
          ),
          // Stated either way, never left blank: "retired" is a real answer a
          // receptionist needs, not the absence of one.
          cell: ({ row }) => (
            <Badge variant={row.original.isActive ? 'default' : 'secondary'}>
              {row.original.isActive
                ? t('plans.status.active')
                : t('plans.status.retired')}
            </Badge>
          ),
        }),
        // No width class and no centering: constraining this column strands
        // the button at the far right of the table.
        columnHelper.display({
          id: 'actions',
          enableSorting: false,
          enableHiding: false,
          cell: ({ row }) => <MembershipPlanRowActions plan={row.original} />,
        }),
      ]),
    [t, page, limit],
  );
}

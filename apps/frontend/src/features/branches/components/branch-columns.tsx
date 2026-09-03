import { useMemo } from 'react';
import { createColumnHelper } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';

import { DataTableColumnHeader } from '@/components/table/column-header';
import type { DataTableFeatures } from '@/components/table/data-table-features';
import { rowNumberColumn } from '@/components/table/row-number-column';
import { Badge } from '@/components/ui/badge';
import type { Branch } from '../data/types';
import { BranchRowActions } from './data-table-row-actions';

const columnHelper = createColumnHelper<DataTableFeatures, Branch>();

/** Renders nullable text — and empty strings — as a single em dash. */
function Muted({ value }: { value: string | null }) {
  return (
    <span className="text-muted-foreground">{value?.trim() ? value : '—'}</span>
  );
}

export function useBranchColumns({
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
              title={t('branches.columns.name')}
            />
          ),
          cell: ({ row }) => (
            <span className="font-medium">{row.original.name}</span>
          ),
        }),
        columnHelper.accessor('city', {
          header: ({ column }) => (
            <DataTableColumnHeader
              column={column}
              title={t('branches.columns.city')}
            />
          ),
          cell: ({ row }) => <Muted value={row.original.city} />,
        }),
        columnHelper.accessor('addressLine', {
          header: ({ column }) => (
            <DataTableColumnHeader
              column={column}
              title={t('branches.columns.address')}
            />
          ),
          cell: ({ row }) => <Muted value={row.original.addressLine} />,
        }),
        columnHelper.accessor('phone', {
          header: ({ column }) => (
            <DataTableColumnHeader
              column={column}
              title={t('branches.columns.phone')}
            />
          ),
          cell: ({ row }) => <Muted value={row.original.phone} />,
        }),
        columnHelper.accessor('isActive', {
          header: ({ column }) => (
            <DataTableColumnHeader
              column={column}
              title={t('branches.columns.status')}
            />
          ),
          cell: ({ row }) => (
            <Badge variant={row.original.isActive ? 'default' : 'secondary'}>
              {row.original.isActive
                ? t('status.active')
                : t('status.inactive')}
            </Badge>
          ),
        }),
        columnHelper.display({
          id: 'actions',
          enableSorting: false,
          enableHiding: false,
          cell: ({ row }) => <BranchRowActions branch={row.original} />,
        }),
      ]),
    [t, page, limit],
  );
}

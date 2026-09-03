import { useMemo } from 'react';
import { createColumnHelper } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';

import { DataTableColumnHeader } from '@/components/table/column-header';
import type { DataTableFeatures } from '@/components/table/data-table-features';
import { rowNumberColumn } from '@/components/table/row-number-column';
import { Badge } from '@/components/ui/badge';
import type { Role } from '../data/types';
import { RoleRowActions } from './data-table-row-actions';

const columnHelper = createColumnHelper<DataTableFeatures, Role>();

export function useRoleColumns({
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
              title={t('roles.columns.name')}
            />
          ),
          cell: ({ row }) => (
            <span className="font-medium">{row.original.name}</span>
          ),
        }),
        columnHelper.accessor('description', {
          header: ({ column }) => (
            <DataTableColumnHeader
              column={column}
              title={t('roles.columns.description')}
            />
          ),
          cell: ({ row }) => (
            <span className="text-muted-foreground">
              {row.original.description?.trim() || '—'}
            </span>
          ),
        }),
        columnHelper.accessor('isActive', {
          header: ({ column }) => (
            <DataTableColumnHeader
              column={column}
              title={t('roles.columns.status')}
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
          cell: ({ row }) => <RoleRowActions role={row.original} />,
        }),
      ]),
    [t, page, limit],
  );
}

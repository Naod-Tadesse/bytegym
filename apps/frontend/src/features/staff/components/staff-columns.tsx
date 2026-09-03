import { useMemo } from 'react';
import { createColumnHelper } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';

import { DataTableColumnHeader } from '@/components/table/column-header';
import type { DataTableFeatures } from '@/components/table/data-table-features';
import { rowNumberColumn } from '@/components/table/row-number-column';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import type { StaffListItem } from '../data/types';
import { StaffRowActions } from './data-table-row-actions';
import { EmploymentStatusBadge } from './employment-status-badge';

const columnHelper = createColumnHelper<DataTableFeatures, StaffListItem>();

function initials(firstName: string, lastName: string) {
  return `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase();
}

export function useStaffColumns({
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
        columnHelper.accessor('firstName', {
          id: 'name',
          header: ({ column }) => (
            <DataTableColumnHeader
              column={column}
              title={t('staff.columns.name')}
            />
          ),
          cell: ({ row }) => (
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarFallback>
                  {initials(row.original.firstName, row.original.lastName)}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col">
                <span className="font-medium">
                  {row.original.firstName} {row.original.lastName}
                </span>
                <span className="text-xs text-muted-foreground">
                  {row.original.staffCode}
                </span>
              </div>
            </div>
          ),
        }),
        columnHelper.accessor('phone', {
          header: ({ column }) => (
            <DataTableColumnHeader
              column={column}
              title={t('staff.columns.phone')}
            />
          ),
          cell: ({ row }) => (
            <span className="tabular-nums text-muted-foreground">
              {row.original.phone}
            </span>
          ),
        }),
        columnHelper.accessor('jobTitle', {
          header: ({ column }) => (
            <DataTableColumnHeader
              column={column}
              title={t('staff.columns.jobTitle')}
            />
          ),
          cell: ({ row }) => <span>{row.original.jobTitle}</span>,
        }),
        columnHelper.accessor('branchName', {
          header: ({ column }) => (
            <DataTableColumnHeader
              column={column}
              title={t('staff.columns.branch')}
            />
          ),
          cell: ({ row }) => (
            <span className="text-muted-foreground">
              {row.original.branchName}
            </span>
          ),
        }),
        columnHelper.display({
          id: 'roles',
          header: () => t('staff.columns.roles'),
          cell: ({ row }) =>
            row.original.roles.length === 0 ? (
              <span className="text-muted-foreground">—</span>
            ) : (
              <div className="flex flex-wrap gap-1">
                {row.original.roles.map((role) => (
                  <Badge key={role.id} variant="secondary">
                    {role.name}
                  </Badge>
                ))}
              </div>
            ),
        }),
        columnHelper.accessor('employmentStatus', {
          header: ({ column }) => (
            <DataTableColumnHeader
              column={column}
              title={t('staff.columns.status')}
            />
          ),
          cell: ({ row }) => (
            <EmploymentStatusBadge status={row.original.employmentStatus} />
          ),
        }),
        columnHelper.display({
          id: 'actions',
          enableHiding: false,
          enableSorting: false,
          cell: ({ row }) => (
            // The row itself navigates; the menu must not trigger that too.
            <div onClick={(event) => event.stopPropagation()}>
              <StaffRowActions staffMember={row.original} />
            </div>
          ),
        }),
      ]),
    [t, page, limit],
  );
}

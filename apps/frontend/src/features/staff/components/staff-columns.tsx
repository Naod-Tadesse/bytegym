import { useMemo } from 'react';
import { createColumnHelper } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';

import { DataTableColumnHeader } from '@/components/table/column-header';
import type { DataTableFeatures } from '@/components/table/data-table-features';
import { rowNumberColumn } from '@/components/table/row-number-column';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { CopyableText } from '@/components/ui/copy-button';
import { useCurrentUser } from '@/features/auth/hooks/use-auth';
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
  const { data: currentUser } = useCurrentUser();
  // At `branch` scope every row is the caller's own branch, so the column
  // would repeat one value down the page.
  const showBranch = currentUser?.dataScope === 'all';

  return useMemo(
    () =>
      columnHelper
        .columns([
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
            // Copyable: the roster is where someone goes to find a number and
            // then paste it somewhere else, and retyping ten digits off a
            // screen is how the wrong person gets called.
            cell: ({ row }) => (
              <CopyableText
                value={row.original.phone}
                label={t('staff.copyPhone')}
                className="tabular-nums text-muted-foreground"
              />
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
            id: 'branchName',
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
          // No roles and no access column: both answer "what can they reach",
          // which is the Users screen's question. This one is the roster — who
          // works here, in what job, at which branch.
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
            // `RowActions` stops the click reaching the row underneath, which
            // would otherwise navigate away as the dialog opens.
            cell: ({ row }) => <StaffRowActions staffMember={row.original} />,
          }),
        ])
        .filter((column) => showBranch || column.id !== 'branchName'),
    [t, page, limit, showBranch],
  );
}

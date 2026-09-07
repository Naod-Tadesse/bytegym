import { useMemo } from 'react';
import { createColumnHelper } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';

import { DataTableColumnHeader } from '@/components/table/column-header';
import type { DataTableFeatures } from '@/components/table/data-table-features';
import { rowNumberColumn } from '@/components/table/row-number-column';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useCurrentUser } from '@/features/auth/hooks/use-auth';
import { formatDate } from '@/lib/format';
import type { MemberListItem } from '../data/types';
import { MemberRowActions } from './data-table-row-actions';
import { MembershipStatusBadge } from './membership-status-badge';

const columnHelper = createColumnHelper<DataTableFeatures, MemberListItem>();

function initials(firstName: string, lastName: string) {
  return `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase();
}

export function useMemberColumns({
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
                title={t('members.columns.member')}
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
                    {row.original.memberCode}
                  </span>
                </div>
              </div>
            ),
          }),
          columnHelper.accessor('phone', {
            header: ({ column }) => (
              <DataTableColumnHeader
                column={column}
                title={t('members.columns.phone')}
              />
            ),
            cell: ({ row }) => (
              <span className="tabular-nums text-muted-foreground">
                {row.original.phone}
              </span>
            ),
          }),
          columnHelper.accessor('branchName', {
            id: 'branchName',
            header: ({ column }) => (
              <DataTableColumnHeader
                column={column}
                title={t('members.columns.branch')}
              />
            ),
            cell: ({ row }) => (
              <span className="text-muted-foreground">
                {row.original.branchName}
              </span>
            ),
          }),
          // The column the front desk actually reads, so it sits before the
          // suspension one: most refusals are unpaid, not barred.
          columnHelper.accessor('membershipStatus', {
            header: ({ column }) => (
              <DataTableColumnHeader
                column={column}
                title={t('members.columns.membership')}
              />
            ),
            cell: ({ row }) => (
              <MembershipStatusBadge
                status={row.original.membershipStatus}
                expiresOn={row.original.expiresOn}
              />
            ),
          }),
          columnHelper.accessor('isSuspended', {
            header: ({ column }) => (
              <DataTableColumnHeader
                column={column}
                title={t('members.columns.status')}
              />
            ),
            // Stated either way, never left blank: not being suspended is a
            // fact the front desk reads, not the absence of one.
            cell: ({ row }) =>
              row.original.isSuspended ? (
                <Badge variant="destructive">
                  {t('members.suspension.suspended')}
                </Badge>
              ) : (
                <Badge variant="secondary">
                  {t('members.suspension.active')}
                </Badge>
              ),
          }),
          columnHelper.accessor('createdAt', {
            header: ({ column }) => (
              <DataTableColumnHeader
                column={column}
                title={t('members.columns.joined')}
              />
            ),
            cell: ({ row }) => (
              <span className="text-muted-foreground">
                {formatDate(row.original.createdAt)}
              </span>
            ),
          }),
          // No width class and no centering: constraining this column strands
          // the button at the far right of the table.
          columnHelper.display({
            id: 'actions',
            enableHiding: false,
            enableSorting: false,
            cell: ({ row }) => <MemberRowActions member={row.original} />,
          }),
        ])
        .filter((column) => showBranch || column.id !== 'branchName'),
    [t, page, limit, showBranch],
  );
}

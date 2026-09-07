import { useMemo } from 'react';
import { createColumnHelper } from '@tanstack/react-table';
import { format, parseISO } from 'date-fns';
import { useTranslation } from 'react-i18next';

import { DataTableColumnHeader } from '@/components/table/column-header';
import type { DataTableFeatures } from '@/components/table/data-table-features';
import { rowNumberColumn } from '@/components/table/row-number-column';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useCurrentUser } from '@/features/auth/hooks/use-auth';
import type { UserListItem } from '../data/types';
import { AccountStatusBadge } from './account-status-badge';
import { UserRowActions } from './data-table-row-actions';

const columnHelper = createColumnHelper<DataTableFeatures, UserListItem>();

function initials(firstName: string, lastName: string) {
  return `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase();
}

export function useUserColumns({
  page,
  limit,
}: {
  page: number;
  limit: number;
}) {
  const { t } = useTranslation();
  const { data: currentUser } = useCurrentUser();
  // At `branch` scope every row is the caller's own branch, so the column
  // would repeat one value down the page — same rule as the staff roster.
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
                title={t('users.columns.name')}
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
          // No job title: this screen answers "what may they reach", and the
          // roles column below is that answer. What they are employed as is
          // the Staff roster's business.
          columnHelper.accessor('branchName', {
            id: 'branchName',
            header: ({ column }) => (
              <DataTableColumnHeader
                column={column}
                title={t('users.columns.branch')}
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
            header: () => t('users.columns.roles'),
            // An account with no roles can sign in and do nothing — worth
            // stating rather than leaving blank.
            cell: ({ row }) =>
              row.original.roles.length === 0 ? (
                <span className="text-muted-foreground">
                  {t('users.noRoles')}
                </span>
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
          columnHelper.accessor('status', {
            header: ({ column }) => (
              <DataTableColumnHeader
                column={column}
                title={t('users.columns.status')}
              />
            ),
            // Never null here: the list is filtered to accounts that exist.
            cell: ({ row }) => (
              <AccountStatusBadge status={row.original.status} />
            ),
          }),
          columnHelper.accessor('lastLoginAt', {
            header: ({ column }) => (
              <DataTableColumnHeader
                column={column}
                title={t('users.columns.lastLogin')}
              />
            ),
            // Null is a real answer here, not missing data: an account granted
            // but never used is exactly what you want to notice on this page.
            cell: ({ row }) =>
              row.original.lastLoginAt ? (
                <span className="text-muted-foreground">
                  {format(parseISO(row.original.lastLoginAt), 'dd MMM yyyy')}
                </span>
              ) : (
                <span className="text-muted-foreground">
                  {t('users.neverSignedIn')}
                </span>
              ),
          }),
          columnHelper.display({
            id: 'actions',
            enableHiding: false,
            enableSorting: false,
            cell: ({ row }) => <UserRowActions user={row.original} />,
          }),
        ])
        .filter((column) => showBranch || column.id !== 'branchName'),
    [t, page, limit, showBranch],
  );
}

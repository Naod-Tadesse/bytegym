import { useMemo } from 'react';
import { createColumnHelper } from '@tanstack/react-table';
import { useTranslation } from 'react-i18next';
import { HugeiconsIcon } from '@hugeicons/react';
import { ShieldKeyIcon } from '@hugeicons/core-free-icons';

import { DataTableColumnHeader } from '@/components/table/column-header';
import type { DataTableFeatures } from '@/components/table/data-table-features';
import { rowNumberColumn } from '@/components/table/row-number-column';
import { Badge } from '@/components/ui/badge';
import { CopyableText } from '@/components/ui/copy-button';
import { useCurrentUser } from '@/features/auth/hooks/use-auth';
import { formatDate } from '@/lib/format';
import { formatGymTime } from '@/lib/gym-day';
import type { AttendanceRecord } from '../data/types';

const columnHelper = createColumnHelper<DataTableFeatures, AttendanceRecord>();

/**
 * The register's columns.
 *
 * A table, not the desk's cards. The desk shows one person at a time and its
 * verdict has to be readable at arm's length; this list is scanned in bulk and
 * compared down the page — which day was busy, who was on, which rows were
 * waved through — and comparing values is what aligned columns are for.
 *
 * There is no actions column, and that is not an omission: attendance is
 * append-only. A visit is not edited, not deleted and not re-dated, so a
 * trailing "⋯" would open a menu with nothing in it.
 */
export function useAttendanceColumns({
  page,
  limit,
}: {
  page: number;
  limit: number;
}) {
  const { t } = useTranslation();
  const { data: currentUser } = useCurrentUser();
  // At `branch` scope the API only ever returns the caller's own branch, so the
  // column would repeat one value down the page.
  const showBranch = currentUser?.dataScope === 'all';

  return useMemo(
    () =>
      columnHelper
        .columns([
          rowNumberColumn(columnHelper, { page, limit }),
          // The gym day as stored, never derived from `checkedInAt`: a 01:00
          // visit in Addis is the previous day in UTC, and the row would move
          // between dates depending on who is reading it.
          columnHelper.accessor('checkedInOn', {
            header: ({ column }) => (
              <DataTableColumnHeader
                column={column}
                title={t('attendance.columns.date')}
              />
            ),
            cell: ({ row }) => (
              <span className="whitespace-nowrap text-muted-foreground">
                {formatDate(row.original.checkedInOn)}
              </span>
            ),
          }),
          // The gym's clock, not the browser's — same reason as the day above.
          columnHelper.accessor('checkedInAt', {
            header: ({ column }) => (
              <DataTableColumnHeader
                column={column}
                title={t('attendance.columns.time')}
              />
            ),
            cell: ({ row }) => (
              <span className="tabular-nums whitespace-nowrap">
                {formatGymTime(row.original.checkedInAt)}
              </span>
            ),
          }),
          // Name and code together in one cell rather than two columns: the code
          // is how the row is read back to the member at the desk, so it belongs
          // beside the name, and copyable because retyping MBR00001 off a screen
          // is how the wrong record gets opened.
          columnHelper.accessor('memberName', {
            header: ({ column }) => (
              <DataTableColumnHeader
                column={column}
                title={t('attendance.columns.member')}
              />
            ),
            cell: ({ row }) => (
              <div className="flex flex-col gap-0.5">
                <span className="font-medium">{row.original.memberName}</span>
                <CopyableText
                  value={row.original.memberCode}
                  label={t('attendance.copyMemberCode')}
                  className="text-xs tabular-nums text-muted-foreground"
                />
              </div>
            ),
          }),
          columnHelper.accessor('branchName', {
            id: 'branchName',
            header: ({ column }) => (
              <DataTableColumnHeader
                column={column}
                title={t('attendance.columns.branch')}
              />
            ),
            cell: ({ row }) => (
              <span className="text-muted-foreground">
                {row.original.branchName}
              </span>
            ),
          }),
          columnHelper.accessor('recordedByName', {
            header: ({ column }) => (
              <DataTableColumnHeader
                column={column}
                title={t('attendance.columns.recordedBy')}
              />
            ),
            // Nullable: a soft-deleted staff row leaves the join empty.
            cell: ({ row }) => (
              <span className="whitespace-nowrap text-muted-foreground">
                {row.original.recordedByName ?? '—'}
              </span>
            ),
          }),
          // Blank on an ordinary check-in, not an em dash and not a "standard"
          // badge. Ninety-five percent of rows carry nothing here, and marking
          // them all would bury the handful that are the reason a manager opens
          // this screen. Under a column headed "Override", empty says "no".
          columnHelper.accessor('overrideByName', {
            header: ({ column }) => (
              <DataTableColumnHeader
                column={column}
                title={t('attendance.columns.override')}
              />
            ),
            cell: ({ row }) =>
              row.original.overrideByName ? (
                <Badge variant="outline" className="whitespace-nowrap">
                  <HugeiconsIcon
                    icon={ShieldKeyIcon}
                    data-icon="inline-start"
                  />
                  {t('attendance.overrideBy', {
                    name: row.original.overrideByName,
                  })}
                </Badge>
              ) : null,
          }),
        ])
        .filter((column) => showBranch || column.id !== 'branchName'),
    [t, page, limit, showBranch],
  );
}

import type { ColumnHelper, RowData } from '@tanstack/react-table';

import type { DataTableFeatures } from './data-table-features';

/**
 * A leading "#" column.
 *
 * The number is absolute across pages, not the index within the page — with a
 * page size of 10, page 2 starts at 11. That only works because paging is
 * server-side, so `page`/`limit` must come from the same table state the query
 * was made with.
 */
export function rowNumberColumn<TData extends RowData>(
  columnHelper: ColumnHelper<DataTableFeatures, TData>,
  { page, limit }: { page: number; limit: number },
) {
  return columnHelper.display({
    id: 'index',
    header: '#',
    enableHiding: false,
    enableSorting: false,
    meta: { className: 'w-10' },
    cell: ({ row }) => (
      <span className="text-muted-foreground">
        {(page - 1) * limit + row.index + 1}
      </span>
    ),
  });
}

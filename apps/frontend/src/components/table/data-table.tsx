import { useCallback, useMemo, useState } from 'react';
import {
  useTable,
  type CellData,
  type ColumnDef,
  type ColumnVisibilityState,
  type RowData,
  type SortingState,
  type TableFeatures,
} from '@tanstack/react-table';
import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon, Search01Icon } from '@hugeicons/core-free-icons';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { DataTableFacetedFilter } from './faceted-filter';
import { DataTablePagination } from './pagination';
import { DataTableViewOptions } from './view-options';
import { features, type DataTableFeatures } from './data-table-features';

// Extend TanStack Table's ColumnMeta with custom class name fields.
// v9 changed the signature to <TFeatures, TData, TValue> — the augmentation
// must match it exactly or TS reports "identical type parameters".
declare module '@tanstack/react-table' {
  interface ColumnMeta<
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    TFeatures extends TableFeatures,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    TData extends RowData,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    TValue extends CellData = CellData,
  > {
    className?: string;
    thClassName?: string;
    tdClassName?: string;
  }
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DataTableProps<
  TData extends RowData,
  TTableState extends { page: number; limit: number; search?: string },
> {
  columns: ColumnDef<DataTableFeatures, TData>[];
  data: TData[];
  setTableState: React.Dispatch<React.SetStateAction<TTableState>>;
  tableState: TTableState;
  isLoading: boolean;
  onRowClick?: (row: TData) => void;
  /** When true, TanStack Table's built-in client-side filtering is enabled using tableState.search as the globalFilter. */
  internalSearch?: boolean;
  /** Placeholder text for the search input */
  searchPlaceholder?: string;
  /** Faceted filters rendered in the toolbar between search and actions. Selections update tableState[field] and are sent to the backend. */
  filters?: {
    field: string;
    title: string;
    /** When true, allows selecting multiple values. Defaults to false (single-select). */
    multiple?: boolean;
    options: {
      label: string;
      value: string;
      icon?: React.ComponentType<{ className?: string }>;
    }[];
  }[];
  /** Elements rendered in the toolbar next to the view options (e.g. action buttons) */
  children?: React.ReactNode;
  /** Initial column visibility state — set a column id to false to hide it on mount */
  initialColumnVisibility?: ColumnVisibilityState;
  paginationInfo: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function DataTable<
  TData extends RowData,
  TTableState extends { page: number; limit: number; search?: string },
>({
  columns,
  data,
  tableState,
  setTableState,
  isLoading,
  onRowClick,
  internalSearch = false,
  searchPlaceholder = 'Search...',
  filters = [],
  children,
  paginationInfo,
  initialColumnVisibility,
}: DataTableProps<TData, TTableState>) {
  // Local UI-only states
  const [rowSelection, setRowSelection] = useState({});
  const [columnVisibility, setColumnVisibility] =
    useState<ColumnVisibilityState>(initialColumnVisibility ?? {});
  const [sorting, setSorting] = useState<SortingState>([]);

  // Derive server-side filter selections from tableState
  const serverFilterValues = useMemo(() => {
    const map: Record<string, Set<string>> = {};
    for (const filter of filters) {
      const raw = (tableState as Record<string, unknown>)[filter.field];
      if (typeof raw === 'string' && raw.length > 0) {
        map[filter.field] = new Set(raw.split(','));
      } else {
        map[filter.field] = new Set();
      }
    }
    return map;
  }, [filters, tableState]);

  const handleFilterChange = useCallback(
    (field: string) => (values: string[] | undefined) => {
      setTableState((prev) => ({
        ...prev,
        page: 1,
        [field]: values && values.length > 0 ? values.join(',') : undefined,
      }));
    },
    [setTableState],
  );

  const hasActiveFilters = filters.some(
    (f) => (serverFilterValues[f.field]?.size ?? 0) > 0,
  );

  // Derive TanStack pagination from external tableState
  const pagination = useMemo(
    () => ({
      pageIndex: Math.max(0, tableState.page - 1),
      pageSize: tableState.limit,
    }),
    [tableState.page, tableState.limit],
  );

  const table = useTable({
    features,
    data,
    columns,
    state: {
      sorting,
      pagination,
      rowSelection,
      columnVisibility,
      ...(internalSearch ? { globalFilter: tableState.search ?? '' } : {}),
    },
    enableRowSelection: true,
    manualPagination: true,
    pageCount: paginationInfo.totalPages,
    rowCount: paginationInfo.total,
    onPaginationChange: (updater) => {
      const next =
        typeof updater === 'function' ? updater(pagination) : updater;
      setTableState((prev) => ({
        ...prev,
        page: next.pageIndex + 1,
        limit: next.pageSize,
      }));
    },
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    onColumnVisibilityChange: setColumnVisibility,
    ...(internalSearch
      ? {
          onGlobalFilterChange: (updater: unknown) => {
            const next =
              typeof updater === 'function'
                ? (updater as (old: string) => string)(tableState.search ?? '')
                : (updater as string);
            setTableState((prev) => ({ ...prev, search: next }));
          },
        }
      : {}),
  });

  const columnCount = columns.length;

  return (
    <div className={cn('flex min-w-0 flex-1 flex-col gap-4')}>
      {/* Toolbar: stacked on mobile, row on sm+ */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-[200px] lg:w-[300px]">
            <HugeiconsIcon
              icon={Search01Icon}
              className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              placeholder={searchPlaceholder}
              value={tableState.search ?? ''}
              onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
                setTableState((prev) => ({
                  ...prev,
                  search: event.target.value,
                  page: 1,
                }))
              }
              className="pl-9"
            />
          </div>
          {filters.map((filter) => (
            <DataTableFacetedFilter
              key={filter.field}
              title={filter.title}
              options={filter.options}
              multiple={filter.multiple}
              selectedValues={serverFilterValues[filter.field] ?? new Set()}
              onFilterChange={handleFilterChange(filter.field)}
            />
          ))}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setTableState((prev) => {
                  const next = { ...prev, page: 1 };
                  for (const filter of filters) {
                    (next as Record<string, unknown>)[filter.field] = undefined;
                  }
                  return next;
                });
              }}
            >
              Reset
              <HugeiconsIcon icon={Cancel01Icon} data-icon="inline-end" />
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="w-full">{children}</div>
          <DataTableViewOptions table={table} />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-md">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="group/row">
                {headerGroup.headers.map((header) => (
                  <TableHead
                    key={header.id}
                    colSpan={header.colSpan}
                    className={cn(
                      'group-hover/row:bg-muted group-data-[state=selected]/row:bg-muted',
                      header.column.columnDef.meta?.className,
                      header.column.columnDef.meta?.thClassName,
                    )}
                  >
                    {header.isPlaceholder ? null : (
                      <table.FlexRender header={header} />
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: tableState.limit }).map((_, rowIdx) => (
                <TableRow key={`skeleton-${rowIdx}`} className="group/row">
                  {Array.from({ length: columnCount }).map((_, colIdx) => (
                    <TableCell key={`skeleton-${rowIdx}-${colIdx}`}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                  className={cn('group/row', onRowClick && 'cursor-pointer')}
                  onClick={
                    onRowClick ? () => onRowClick(row.original) : undefined
                  }
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={cn(
                        'group-hover/row:bg-muted group-data-[state=selected]/row:bg-muted',
                        cell.column.columnDef.meta?.className,
                        cell.column.columnDef.meta?.tdClassName,
                      )}
                    >
                      <table.FlexRender cell={cell} />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columnCount} className="h-24 text-center">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <DataTablePagination
        paginationInfo={paginationInfo}
        setTableState={setTableState}
        className="mt-auto"
      />
    </div>
  );
}

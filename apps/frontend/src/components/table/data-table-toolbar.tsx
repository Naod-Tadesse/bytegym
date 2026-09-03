import type { RowData, Table } from '@tanstack/react-table';
import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon } from '@hugeicons/core-free-icons';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { DataTableFacetedFilter } from './faceted-filter';
import { DataTableViewOptions } from './view-options';
import type { DataTableFeatures } from './data-table-features';

type DataTableToolbarProps<TData extends RowData> = {
  table: Table<DataTableFeatures, TData>;
  searchPlaceholder?: string;
  /** Column id to filter on. Required — v9 has no global filter registered. */
  searchKey?: string;
  filters?: {
    columnId: string;
    title: string;
    options: {
      label: string;
      value: string;
      icon?: React.ComponentType<{ className?: string }>;
    }[];
  }[];
};

export function DataTableToolbar<TData extends RowData>({
  table,
  searchPlaceholder = 'Filter...',
  searchKey,
  filters = [],
}: DataTableToolbarProps<TData>) {
  // v9 removed `table.getState()`; derive active-filter state from the columns.
  const isFiltered = table
    .getAllColumns()
    .some((column) => column.getFilterValue() !== undefined);

  return (
    <div className="flex items-center justify-between">
      <div className="flex flex-1 flex-col-reverse items-start gap-y-2 sm:flex-row sm:items-center sm:gap-x-2">
        {searchKey && (
          <Input
            placeholder={searchPlaceholder}
            value={
              (table.getColumn(searchKey)?.getFilterValue() as string) ?? ''
            }
            onChange={(event: React.ChangeEvent<HTMLInputElement>) =>
              table.getColumn(searchKey)?.setFilterValue(event.target.value)
            }
            className="w-[150px] lg:w-[250px]"
          />
        )}
        <div className="flex gap-x-2">
          {filters.map((filter) => {
            const column = table.getColumn(filter.columnId);
            if (!column) return null;

            const filterValue = column.getFilterValue();
            const selectedValues = new Set(
              Array.isArray(filterValue)
                ? filterValue.map(String)
                : filterValue
                  ? [String(filterValue)]
                  : [],
            );

            return (
              <DataTableFacetedFilter
                key={filter.columnId}
                title={filter.title}
                options={filter.options}
                multiple
                selectedValues={selectedValues}
                onFilterChange={(values) => column.setFilterValue(values)}
              />
            );
          })}
        </div>
        {isFiltered && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => table.resetColumnFilters()}
          >
            Reset
            <HugeiconsIcon icon={Cancel01Icon} data-icon="inline-end" />
          </Button>
        )}
      </div>
      <DataTableViewOptions table={table} />
    </div>
  );
}

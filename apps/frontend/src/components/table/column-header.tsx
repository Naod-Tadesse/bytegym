import type { CellData, Column, RowData } from '@tanstack/react-table';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  ArrowDown01Icon,
  ArrowUp01Icon,
  ArrowUpDownIcon,
  ViewOffIcon,
} from '@hugeicons/core-free-icons';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { DataTableFeatures } from './data-table-features';

interface DataTableColumnHeaderProps<
  TData extends RowData,
  TValue extends CellData,
> extends React.HTMLAttributes<HTMLDivElement> {
  column: Column<DataTableFeatures, TData, TValue>;
  title: string;
}

export function DataTableColumnHeader<
  TData extends RowData,
  TValue extends CellData,
>({ column, title, className }: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column.getCanSort()) {
    return <div className={cn(className)}>{title}</div>;
  }

  const sorted = column.getIsSorted();

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              className="-ml-3 data-[state=open]:bg-accent"
            />
          }
        >
          <span>{title}</span>
          <HugeiconsIcon
            icon={
              sorted === 'desc'
                ? ArrowDown01Icon
                : sorted === 'asc'
                  ? ArrowUp01Icon
                  : ArrowUpDownIcon
            }
            data-icon="inline-end"
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuGroup>
            <DropdownMenuItem onClick={() => column.toggleSorting(false)}>
              <HugeiconsIcon icon={ArrowUp01Icon} data-icon="inline-start" />
              Asc
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => column.toggleSorting(true)}>
              <HugeiconsIcon icon={ArrowDown01Icon} data-icon="inline-start" />
              Desc
            </DropdownMenuItem>
          </DropdownMenuGroup>
          {column.getCanHide() && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuItem
                  onClick={() => column.toggleVisibility(false)}
                >
                  <HugeiconsIcon icon={ViewOffIcon} data-icon="inline-start" />
                  Hide
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

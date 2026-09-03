import { HugeiconsIcon } from '@hugeicons/react';
import {
  ArrowLeft01Icon,
  ArrowLeftDoubleIcon,
  ArrowRight01Icon,
  ArrowRightDoubleIcon,
} from '@hugeicons/core-free-icons';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/**
 * Builds a windowed page list with `…` gaps, e.g. `1 … 4 5 6 … 20`.
 * Previously imported from a shared barrel that does not exist in this repo.
 */
function getPageNumbers(
  currentPage: number,
  totalPages: number,
  siblings = 1,
): Array<number | '...'> {
  if (totalPages <= 0) return [];

  const pages: Array<number | '...'> = [];
  const first = 1;
  const last = totalPages;
  const start = Math.max(first, currentPage - siblings);
  const end = Math.min(last, currentPage + siblings);

  pages.push(first);
  if (start > first + 1) pages.push('...');
  for (let page = start; page <= end; page += 1) {
    if (page !== first && page !== last) pages.push(page);
  }
  if (end < last - 1) pages.push('...');
  if (last !== first) pages.push(last);

  return pages;
}

type DataTablePaginationProps<
  TTableState extends { page: number; limit: number },
> = {
  paginationInfo: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  setTableState: React.Dispatch<React.SetStateAction<TTableState>>;
  className?: string;
};

export function DataTablePagination<
  TTableState extends { page: number; limit: number },
>({
  paginationInfo,
  setTableState,
  className,
}: DataTablePaginationProps<TTableState>) {
  const {
    page: currentPage,
    totalPages,
    hasNext,
    hasPrev,
    limit,
    total,
  } = paginationInfo;
  const pageNumbers = getPageNumbers(currentPage, totalPages);

  const rangeStart = total === 0 ? 0 : (currentPage - 1) * limit + 1;
  const rangeEnd = Math.min(currentPage * limit, total);

  const goToPage = (targetPage: number) => {
    setTableState((prev) => ({ ...prev, page: targetPage }));
  };

  const setPageSize = (size: number) => {
    setTableState((prev) => ({ ...prev, limit: size, page: 1 }));
  };

  return (
    <div
      className={cn(
        'flex flex-col gap-3 px-2 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      {/* Left: range info + rows per page */}
      <div className="flex items-center gap-3">
        <span className="text-sm whitespace-nowrap text-muted-foreground">
          {rangeStart}-{rangeEnd} of {total}
        </span>
        <div className="flex items-center gap-2">
          <span className="hidden text-sm sm:inline">Rows per page</span>
          <Select
            value={`${limit}`}
            onValueChange={(value) => setPageSize(Number(value))}
          >
            <SelectTrigger className="w-[70px]">
              <SelectValue placeholder={`${limit}`} />
            </SelectTrigger>
            <SelectContent side="top">
              {[10, 20, 30, 40, 50].map((pageSize) => (
                <SelectItem key={pageSize} value={`${pageSize}`}>
                  {pageSize}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Right: page navigation */}
      <div className="flex items-center gap-1">
        <span className="mr-2 hidden text-sm whitespace-nowrap text-muted-foreground sm:inline">
          Page {currentPage} of {totalPages}
        </span>
        <Button
          variant="outline"
          size="icon-sm"
          className="hidden sm:flex"
          onClick={() => goToPage(1)}
          disabled={!hasPrev}
        >
          <span className="sr-only">Go to first page</span>
          <HugeiconsIcon icon={ArrowLeftDoubleIcon} />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => goToPage(currentPage - 1)}
          disabled={!hasPrev}
        >
          <span className="sr-only">Go to previous page</span>
          <HugeiconsIcon icon={ArrowLeft01Icon} />
        </Button>

        {/* Page number buttons — hidden on small screens */}
        <div className="hidden items-center gap-1 sm:flex">
          {pageNumbers.map((pageNumber, index) => (
            <div key={`${pageNumber}-${index}`} className="flex items-center">
              {pageNumber === '...' ? (
                <span className="px-1 text-sm text-muted-foreground">…</span>
              ) : (
                <Button
                  variant={currentPage === pageNumber ? 'default' : 'outline'}
                  size="sm"
                  className="min-w-9"
                  onClick={() => goToPage(pageNumber)}
                >
                  <span className="sr-only">Go to page {pageNumber}</span>
                  {pageNumber}
                </Button>
              )}
            </div>
          ))}
        </div>

        {/* Mobile: simple page indicator */}
        <span className="px-2 text-sm text-muted-foreground sm:hidden">
          {currentPage} / {totalPages}
        </span>

        <Button
          variant="outline"
          size="icon-sm"
          onClick={() => goToPage(currentPage + 1)}
          disabled={!hasNext}
        >
          <span className="sr-only">Go to next page</span>
          <HugeiconsIcon icon={ArrowRight01Icon} />
        </Button>
        <Button
          variant="outline"
          size="icon-sm"
          className="hidden sm:flex"
          onClick={() => goToPage(totalPages)}
          disabled={!hasNext}
        >
          <span className="sr-only">Go to last page</span>
          <HugeiconsIcon icon={ArrowRightDoubleIcon} />
        </Button>
      </div>
    </div>
  );
}

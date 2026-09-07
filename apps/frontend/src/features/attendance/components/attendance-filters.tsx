import { useState, type Dispatch, type SetStateAction } from 'react';
import { useTranslation } from 'react-i18next';
import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon } from '@hugeicons/core-free-icons';

import {
  DataCombobox,
  type DataComboboxOption,
} from '@/components/data-combobox';
import { Button } from '@/components/ui/button';
import { useCurrentUser } from '@/features/auth/hooks/use-auth';
import { usePermissions } from '@/features/auth/hooks/use-permissions';
import { useBranchOptions } from '@/features/branches/hooks/use-branches';
import { useMemberOptions } from '@/features/members/hooks/use-members';
// Reused rather than copied: attendance and payments ask the same question of
// the same kind of endpoint, and two calendars would drift apart on the first
// bug fixed in one of them.
import { DateRangeFilter } from '@/features/payments/components/date-range-filter';
import { useDebounce } from '@/hooks/use-debounce';
import { gymToday } from '@/lib/gym-day';
import type { AttendanceTableState } from '../data/types';

interface AttendanceFiltersProps {
  tableState: AttendanceTableState;
  setTableState: Dispatch<SetStateAction<AttendanceTableState>>;
}

/**
 * The three questions this screen is opened to answer narrowed: when, who, and
 * where.
 *
 * Every one of them resets to page 1. Page four of an unfiltered month is very
 * unlikely to still exist once a single member is picked, and landing on an
 * empty page reads as "they never came in".
 */
export function AttendanceFilters({
  tableState,
  setTableState,
}: AttendanceFiltersProps) {
  const { hasPermission } = usePermissions();
  const { data: currentUser } = useCurrentUser();

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <DateRangeFilter
        value={{ from: tableState.from, to: tableState.to }}
        onChange={(range) =>
          setTableState((previous) => ({
            ...previous,
            // Clearing means "back to today", not "all time". The range is what
            // the heading counts over, so it is never allowed to go unset: with
            // both bounds empty the server would quietly apply its own default
            // of today anyway, and the button would sit there reading "All
            // dates" over a single day's rows.
            //
            // A half-set range is left alone — that is the first click of a
            // two-click selection, and the server reads the open end as today.
            ...(range.from || range.to
              ? range
              : { from: gymToday(), to: gymToday() }),
            page: 1,
          }))
        }
      />

      {/* Filtering by member means listing members. Someone who can read
          attendance but not the roster gets the rest of the filters rather than
          a control that 403s on every keystroke. */}
      {hasPermission('member.list') && (
        <MemberFilter
          value={tableState.memberId}
          onChange={(memberId) =>
            setTableState((previous) => ({ ...previous, memberId, page: 1 }))
          }
        />
      )}

      {/* Two conditions, and they answer different questions. Scope decides
          whether the filter *means* anything: a branch-scoped caller is pinned
          to their own branch by the API regardless, so the control could only
          ever pick between "my branch" and an empty page. Permission decides
          whether it would *work*: the option list is `GET /api/branches`, which
          is `branch.list`, and an `all`-scope role need not carry it.

          `resolvePermissions()` strips `branch.*` at branch scope, so today the
          permission check subsumes the scope one — stated separately anyway,
          because that is an invariant living in another codebase. */}
      {currentUser?.dataScope === 'all' && hasPermission('branch.list') && (
        <BranchFilter
          value={tableState.branchId}
          onChange={(branchId) =>
            setTableState((previous) => ({ ...previous, branchId, page: 1 }))
          }
        />
      )}
    </div>
  );
}

interface FilterProps {
  value: string | undefined;
  onChange: (next: string | undefined) => void;
}

/** Shared trigger width, so the row of filters lines up at any zoom. */
const TRIGGER_WIDTH = 'w-[200px]';

function MemberFilter({ value, onChange }: FilterProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  /**
   * The picked option, kept here rather than read back out of `options`.
   *
   * Once the search term moves on, the selected member is no longer in the
   * loaded page — so without this the trigger would go blank while the filter
   * was still very much applied.
   */
  const [selected, setSelected] = useState<DataComboboxOption>();

  const { options, fetchNextPage, hasNextPage, isLoading } = useMemberOptions(
    useDebounce(search),
  );

  return (
    <FilterCombobox
      value={value}
      options={options}
      selectedOption={selected}
      placeholder={t('attendance.filters.allMembers')}
      searchPlaceholder={t('attendance.filters.searchMembers')}
      emptyMessage={t('attendance.filters.noMembers')}
      clearLabel={t('attendance.filters.clearMember')}
      onSearch={setSearch}
      onScroll={fetchNextPage}
      hasNext={hasNextPage}
      isLoading={isLoading}
      onChange={(next) => {
        setSelected(options.find((option) => option.value === next));
        onChange(next);
      }}
    />
  );
}

function BranchFilter({ value, onChange }: FilterProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<DataComboboxOption>();

  const { options, fetchNextPage, hasNextPage, isLoading } = useBranchOptions(
    useDebounce(search),
  );

  return (
    <FilterCombobox
      value={value}
      options={options}
      selectedOption={selected}
      placeholder={t('attendance.filters.allBranches')}
      searchPlaceholder={t('attendance.filters.searchBranches')}
      emptyMessage={t('attendance.filters.noBranches')}
      clearLabel={t('attendance.filters.clearBranch')}
      onSearch={setSearch}
      onScroll={fetchNextPage}
      hasNext={hasNextPage}
      isLoading={isLoading}
      onChange={(next) => {
        setSelected(options.find((option) => option.value === next));
        onChange(next);
      }}
    />
  );
}

/**
 * A `DataCombobox` used as a filter rather than a form field.
 *
 * The difference is the empty state. A form field's empty value is "not filled
 * in yet"; a filter's is "everything", which is a real selection and needs its
 * own way back — hence the explicit clear button beside it. Re-picking the
 * selected row also clears it, but nobody discovers that.
 *
 * `onChange` normalises the combobox's `''` to `undefined`, because that is what
 * the table state means by "not filtering" and what the query builder omits.
 */
function FilterCombobox({
  value,
  options,
  selectedOption,
  placeholder,
  searchPlaceholder,
  emptyMessage,
  clearLabel,
  onSearch,
  onScroll,
  hasNext,
  isLoading,
  onChange,
}: {
  value: string | undefined;
  options: DataComboboxOption[];
  selectedOption: DataComboboxOption | undefined;
  placeholder: string;
  searchPlaceholder: string;
  emptyMessage: string;
  clearLabel: string;
  onSearch: (search: string) => void;
  onScroll: () => void;
  hasNext: boolean;
  isLoading: boolean;
  onChange: (next: string | undefined) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <DataCombobox
        value={value ?? ''}
        options={options}
        selectedOption={selectedOption}
        placeholder={placeholder}
        searchPlaceholder={searchPlaceholder}
        emptyMessage={emptyMessage}
        // No `internalSearch`: `onSearch` is set, and filtering the server's
        // already-filtered page a second time in the browser would hide rows
        // the API deliberately returned.
        onSearch={onSearch}
        onScroll={onScroll}
        hasNext={hasNext}
        isLoading={isLoading}
        onChange={(next) => onChange(next || undefined)}
        className={TRIGGER_WIDTH}
      />
      {value && (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={clearLabel}
          onClick={() => onChange(undefined)}
        >
          <HugeiconsIcon icon={Cancel01Icon} />
        </Button>
      )}
    </div>
  );
}

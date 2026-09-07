import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import { useTranslation } from 'react-i18next';
import { HugeiconsIcon } from '@hugeicons/react';
import { CalendarRangeIcon, Cancel01Icon } from '@hugeicons/core-free-icons';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { formatDate } from '@/lib/format';

export interface DateRangeValue {
  from?: string;
  to?: string;
}

interface DateRangeFilterProps {
  value: DateRangeValue;
  onChange: (next: DateRangeValue) => void;
}

/** The API takes date-only bounds; the calendar hands back `Date`s. */
const toIso = (date: Date | undefined) =>
  date ? format(date, 'yyyy-MM-dd') : undefined;

/**
 * The payments list's one filter: which shift, which day, which week.
 *
 * Both bounds are inclusive, matching the API — picking a single day gives that
 * day's takings rather than an empty range.
 */
export function DateRangeFilter({ value, onChange }: DateRangeFilterProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const hasRange = Boolean(value.from || value.to);
  const selected: DateRange | undefined = hasRange
    ? {
        from: value.from ? parseISO(value.from) : undefined,
        to: value.to ? parseISO(value.to) : undefined,
      }
    : undefined;

  const label = !hasRange
    ? t('payments.dateRange.all')
    : value.from && value.to
      ? `${formatDate(value.from)} — ${formatDate(value.to)}`
      : // Mid-selection, or a single open-ended bound: say which end is set
        // rather than rendering half a range as if it were the whole thing.
        t('payments.dateRange.partial', {
          date: formatDate((value.from ?? value.to) as string),
        });

  return (
    <div className="flex items-center gap-1">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={<Button variant="outline" data-empty={!hasRange} />}
        >
          <HugeiconsIcon icon={CalendarRangeIcon} data-icon="inline-start" />
          {label}
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="range"
            selected={selected}
            onSelect={(range) =>
              onChange({ from: toIso(range?.from), to: toIso(range?.to) })
            }
          />
        </PopoverContent>
      </Popover>
      {hasRange && (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={t('payments.dateRange.clear')}
          onClick={() => onChange({ from: undefined, to: undefined })}
        >
          <HugeiconsIcon icon={Cancel01Icon} />
        </Button>
      )}
    </div>
  );
}

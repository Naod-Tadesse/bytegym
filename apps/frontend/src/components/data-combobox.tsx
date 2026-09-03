import { useEffect, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowUpDownIcon, Tick02Icon } from '@hugeicons/core-free-icons';
import { useInView } from 'react-intersection-observer';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Spinner } from '@/components/ui/spinner';
import { LongText } from '@/components/table/long-text';

export interface DataComboboxOption {
  value: string;
  label: string;
}

export interface DataComboboxProps {
  value?: string;
  onChange?: (value: string) => void;
  options: DataComboboxOption[];
  /**
   * The option matching `value` when it is not part of the loaded `options`
   * (e.g. a prefilled value whose row lives on a page that hasn't loaded).
   * Used for the trigger label and pinned as the first list item.
   */
  selectedOption?: DataComboboxOption;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  'aria-invalid'?: boolean;
  /** Raw search term. When provided, client-side filtering is disabled. */
  onSearch?: (search: string) => void;
  /** Called when the list bottom scrolls into view and `hasNext` is true. */
  onScroll?: () => void;
  hasNext?: boolean;
  isLoading?: boolean;
  loadingMessage?: string;
  allowCustomValue?: boolean;
  internalSearch?: boolean;
}

export function DataCombobox({
  value,
  onChange,
  options,
  selectedOption,
  placeholder = '',
  searchPlaceholder = 'Search...',
  emptyMessage = 'No results found.',
  disabled = false,
  className,
  id,
  'aria-invalid': ariaInvalid,
  onSearch,
  onScroll,
  hasNext = false,
  isLoading = false,
  loadingMessage = 'Loading...',
  allowCustomValue = false,
  internalSearch = false,
}: DataComboboxProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [lastSelected, setLastSelected] = useState<
    DataComboboxOption | undefined
  >(undefined);

  const { ref, inView } = useInView({ threshold: 0 });

  useEffect(() => {
    if (inView && hasNext && onScroll) {
      onScroll();
    }
  }, [inView, hasNext, onScroll]);

  // Resolve the current option: in the loaded page → external prefill → in-session memory.
  const resolved =
    options.find((opt) => opt.value === value) ??
    (selectedOption?.value === value ? selectedOption : undefined) ??
    (lastSelected?.value === value ? lastSelected : undefined);

  const displayLabel = resolved
    ? resolved.label
    : allowCustomValue && value
      ? String(value)
      : null;

  // Pin the resolved selection at the top only when it isn't already listed.
  const pinnedOption =
    resolved && !options.some((opt) => opt.value === resolved.value)
      ? resolved
      : undefined;

  const hasExactMatch = options.some(
    (opt) => opt.label.toLowerCase() === searchValue.toLowerCase(),
  );

  const handleSearch = (next: string) => {
    setSearchValue(next);
    onSearch?.(next);
  };

  const selectOption = (option: DataComboboxOption) => {
    const nextValue = option.value === value ? '' : option.value;
    setLastSelected(option);
    onChange?.(nextValue);
    setOpen(false);
  };

  const handleSelectCustomValue = () => {
    const custom = searchValue.trim();
    if (allowCustomValue && custom) {
      setLastSelected({ value: custom, label: custom });
      onChange?.(custom);
      setSearchValue('');
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen} modal>
      <PopoverTrigger
        render={
          <Button
            id={id}
            variant="outline"
            role="combobox"
            aria-expanded={open}
            aria-invalid={ariaInvalid}
            disabled={disabled}
            className={cn(
              'w-full justify-between gap-2 font-normal',
              className,
            )}
          />
        }
      >
        <div className="min-w-0 flex-1 overflow-hidden">
          {displayLabel ? (
            <LongText className="text-left">{displayLabel}</LongText>
          ) : (
            <span className="block truncate text-left text-muted-foreground">
              {placeholder}
            </span>
          )}
        </div>
        <HugeiconsIcon icon={ArrowUpDownIcon} className="shrink-0 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="min-w-(--anchor-width) p-0">
        <Command shouldFilter={internalSearch || !onSearch}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={searchValue}
            onValueChange={handleSearch}
          />
          <CommandList>
            <CommandEmpty>
              {isLoading ? (
                <div className="text-muted-foreground flex items-center justify-center gap-2 py-2 text-sm">
                  <Spinner />
                  {loadingMessage}
                </div>
              ) : allowCustomValue && searchValue.trim() ? (
                <button
                  type="button"
                  className="hover:bg-accent w-full cursor-pointer rounded px-2 py-1.5 text-left text-sm"
                  onClick={handleSelectCustomValue}
                >
                  Create &quot;{searchValue.trim()}&quot;
                </button>
              ) : (
                emptyMessage
              )}
            </CommandEmpty>
            {pinnedOption && (
              <>
                <CommandGroup>
                  <CommandItem
                    value={pinnedOption.label}
                    onSelect={() => selectOption(pinnedOption)}
                  >
                    <HugeiconsIcon icon={Tick02Icon} data-icon="inline-start" />
                    {pinnedOption.label}
                  </CommandItem>
                </CommandGroup>
                <CommandSeparator />
              </>
            )}
            <CommandGroup>
              {allowCustomValue &&
                searchValue.trim() &&
                !hasExactMatch &&
                options.length > 0 && (
                  <CommandItem
                    value={`__create__${searchValue}`}
                    onSelect={handleSelectCustomValue}
                  >
                    Create &quot;{searchValue.trim()}&quot;
                  </CommandItem>
                )}
              {options.map((opt) => (
                <CommandItem
                  key={opt.value}
                  value={opt.label}
                  onSelect={() => selectOption(opt)}
                >
                  <HugeiconsIcon
                    icon={Tick02Icon}
                    data-icon="inline-start"
                    className={cn(
                      value === opt.value ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  {opt.label}
                </CommandItem>
              ))}
              {isLoading && options.length > 0 && (
                <div className="text-muted-foreground flex items-center justify-center gap-2 py-2 text-sm">
                  <Spinner />
                  {loadingMessage}
                </div>
              )}
              {hasNext && <div ref={ref} className="h-4" />}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

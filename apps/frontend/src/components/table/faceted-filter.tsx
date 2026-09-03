import * as React from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { PlusSignCircleIcon, Tick02Icon } from '@hugeicons/core-free-icons';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';

type DataTableFacetedFilterProps = {
  title?: string;
  options: {
    label: string;
    value: string;
    icon?: React.ComponentType<{ className?: string }>;
  }[];
  /** When true, allows selecting multiple values. Defaults to false (single-select). */
  multiple?: boolean;
  selectedValues: Set<string>;
  onFilterChange: (values: string[] | undefined) => void;
};

export function DataTableFacetedFilter({
  title,
  options,
  multiple = false,
  selectedValues,
  onFilterChange,
}: DataTableFacetedFilterProps) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="outline" size="sm" className="border-dashed" />
        }
      >
        <HugeiconsIcon icon={PlusSignCircleIcon} data-icon="inline-start" />
        {title}
        {selectedValues?.size > 0 && (
          <>
            <Separator orientation="vertical" className="mx-2 h-4" />
            <Badge
              variant="secondary"
              className="rounded-sm px-1 font-normal lg:hidden"
            >
              {selectedValues.size}
            </Badge>
            <div className="hidden gap-1 lg:flex">
              {selectedValues.size > 2 ? (
                <Badge
                  variant="secondary"
                  className="rounded-sm px-1 font-normal"
                >
                  {selectedValues.size} selected
                </Badge>
              ) : (
                options
                  .filter((option) => selectedValues.has(option.value))
                  .map((option) => (
                    <Badge
                      variant="secondary"
                      key={option.value}
                      className="rounded-sm px-1 font-normal"
                    >
                      {option.label}
                    </Badge>
                  ))
              )}
            </div>
          </>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" align="start">
        <Command>
          <CommandInput placeholder={title} />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              {options.map((option) => {
                const isSelected = selectedValues.has(option.value);
                return (
                  <CommandItem
                    key={option.value}
                    onSelect={() => {
                      if (multiple) {
                        const next = new Set(selectedValues);
                        if (isSelected) {
                          next.delete(option.value);
                        } else {
                          next.add(option.value);
                        }
                        const filterValues = Array.from(next);
                        onFilterChange(
                          filterValues.length ? filterValues : undefined,
                        );
                      } else {
                        // Single-select: toggle off if already selected, otherwise replace
                        onFilterChange(isSelected ? undefined : [option.value]);
                      }
                    }}
                  >
                    <div
                      className={cn(
                        'flex size-4 items-center justify-center border border-primary',
                        multiple ? 'rounded-sm' : 'rounded-full',
                        isSelected
                          ? 'bg-primary text-primary-foreground'
                          : 'opacity-50 [&_svg]:invisible',
                      )}
                    >
                      <HugeiconsIcon
                        icon={Tick02Icon}
                        className="text-background"
                      />
                    </div>
                    {option.icon && (
                      <option.icon className="size-4 text-muted-foreground" />
                    )}
                    <span>{option.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
            {selectedValues.size > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup>
                  <CommandItem
                    onSelect={() => onFilterChange(undefined)}
                    className="justify-center text-center"
                  >
                    Clear filters
                  </CommandItem>
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

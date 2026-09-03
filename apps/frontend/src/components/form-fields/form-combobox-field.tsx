import { Field, FieldLabel, FieldError } from '../ui/field';
import {
  DataCombobox,
  type DataComboboxOption,
} from '@/components/data-combobox';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface FormComboboxFieldProps {
  form: any;
  name: string;
  label: string;
  options: DataComboboxOption[];
  required?: boolean;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  className?: string;
  selectedOption?: DataComboboxOption;
  onValueChange?: (value: string) => void;
  onSearch?: (search: string) => void;
  onScroll?: () => void;
  hasNext?: boolean;
  allowCustomValue?: boolean;
  isLoading?: boolean;
  loadingMessage?: string;
  internalSearch?: boolean;
}

export function FormComboboxField({
  form,
  name,
  label,
  options,
  required = false,
  placeholder = '',
  searchPlaceholder = 'Search...',
  emptyMessage = 'No results found.',
  disabled = false,
  className,
  selectedOption,
  onValueChange,
  onSearch,
  onScroll,
  hasNext = false,
  allowCustomValue = false,
  isLoading = false,
  loadingMessage = 'Loading...',
  internalSearch = false,
}: FormComboboxFieldProps) {
  return (
    <form.Field name={name}>
      {(field: any) => {
        const isInvalid =
          field.state.meta.isTouched && !field.state.meta.isValid;
        return (
          <Field data-invalid={isInvalid || undefined} className={className}>
            <FieldLabel htmlFor={field.name}>
              {label} {required && <span className="text-destructive">*</span>}
            </FieldLabel>
            <DataCombobox
              id={field.name}
              value={field.state.value}
              onChange={(value: string) => {
                field.handleChange(value);
                onValueChange?.(value);
              }}
              options={options}
              selectedOption={selectedOption}
              placeholder={placeholder}
              searchPlaceholder={searchPlaceholder}
              emptyMessage={emptyMessage}
              disabled={disabled}
              aria-invalid={isInvalid || undefined}
              onSearch={onSearch}
              onScroll={onScroll}
              hasNext={hasNext}
              isLoading={isLoading}
              loadingMessage={loadingMessage}
              allowCustomValue={allowCustomValue}
              internalSearch={internalSearch}
            />
            {isInvalid && <FieldError errors={field.state.meta.errors} />}
          </Field>
        );
      }}
    </form.Field>
  );
}

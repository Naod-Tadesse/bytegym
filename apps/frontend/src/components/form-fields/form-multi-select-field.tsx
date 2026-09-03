import { Field, FieldLabel, FieldError } from '../ui/field';
import {
  MultiSelect,
  MultiSelectTrigger,
  MultiSelectValue,
  MultiSelectContent,
  MultiSelectItem,
  MultiSelectGroup,
} from '../ui/multiselect';

interface MultiSelectOption {
  value: string;
  label: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
interface FormMultiSelectFieldProps {
  form: any;
  name: string;
  label: string;
  options: MultiSelectOption[];
  required?: boolean;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  search?: boolean | { placeholder?: string; emptyMessage?: string };
}

export function FormMultiSelectField({
  form,
  name,
  label,
  options,
  required = false,
  placeholder = '',
  disabled = false,
  className,
  search = true,
}: FormMultiSelectFieldProps) {
  return (
    <form.Field name={name}>
      {(field: any) => {
        const isInvalid =
          field.state.meta.isTouched && !field.state.meta.isValid;
        const values: string[] = field.state.value ?? [];

        return (
          <Field data-invalid={isInvalid || undefined} className={className}>
            <FieldLabel htmlFor={field.name}>
              {label} {required && <span className="text-destructive">*</span>}
            </FieldLabel>
            <MultiSelect
              values={values}
              onValuesChange={(v) => field.handleChange(v)}
            >
              <MultiSelectTrigger
                id={field.name}
                className="w-full"
                disabled={disabled}
              >
                <MultiSelectValue placeholder={placeholder} />
              </MultiSelectTrigger>
              <MultiSelectContent search={search}>
                <MultiSelectGroup>
                  {options.map((opt) => (
                    <MultiSelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </MultiSelectItem>
                  ))}
                </MultiSelectGroup>
              </MultiSelectContent>
            </MultiSelect>
            {isInvalid && <FieldError errors={field.state.meta.errors} />}
          </Field>
        );
      }}
    </form.Field>
  );
}

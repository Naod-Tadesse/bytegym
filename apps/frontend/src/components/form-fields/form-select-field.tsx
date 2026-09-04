import { Field, FieldLabel, FieldError } from '../ui/field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

interface SelectOption {
  value: string;
  label: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
interface FormSelectFieldProps {
  form: any;
  name: string;
  label: string;
  options: SelectOption[];
  required?: boolean;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function FormSelectField({
  form,
  name,
  label,
  options,
  required = false,
  placeholder = '',
  disabled = false,
  className,
}: FormSelectFieldProps) {
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
            <Select
              // Without `items`, Base UI's Select.Value renders the raw value —
              // so a uuid-valued field shows the uuid, and an enum shows
              // `on_leave` rather than "On leave". It only looks right when the
              // value happens to equal the label.
              items={options}
              value={field.state.value ?? ''}
              onValueChange={(v) => field.handleChange(v)}
              disabled={disabled}
            >
              <SelectTrigger id={field.name}>
                <SelectValue placeholder={placeholder} />
              </SelectTrigger>
              <SelectContent>
                {options.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isInvalid && <FieldError errors={field.state.meta.errors} />}
          </Field>
        );
      }}
    </form.Field>
  );
}

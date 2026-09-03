import { Field, FieldLabel, FieldError } from '../ui/field';
import { Textarea } from '../ui/textarea';

/* eslint-disable @typescript-eslint/no-explicit-any */
interface FormTextareaFieldProps {
  form: any;
  name: string;
  label: string;
  required?: boolean;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  rows?: number;
}

export function FormTextareaField({
  form,
  name,
  label,
  required = false,
  placeholder = '',
  disabled = false,
  className,
  rows,
}: FormTextareaFieldProps) {
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
            <Textarea
              id={field.name}
              name={field.name}
              value={field.state.value ?? ''}
              onBlur={field.handleBlur}
              onChange={(e) => field.handleChange(e.target.value)}
              aria-invalid={isInvalid}
              placeholder={placeholder}
              disabled={disabled}
              rows={rows}
            />
            {isInvalid && <FieldError errors={field.state.meta.errors} />}
          </Field>
        );
      }}
    </form.Field>
  );
}

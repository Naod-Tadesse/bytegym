import { Field, FieldLabel, FieldDescription, FieldError } from '../ui/field';
import { Switch } from '../ui/switch';

/* eslint-disable @typescript-eslint/no-explicit-any */
interface FormSwitchFieldProps {
  form: any;
  name: string;
  label: string;
  description?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

export function FormSwitchField({
  form,
  name,
  label,
  description,
  required = false,
  disabled = false,
  className,
}: FormSwitchFieldProps) {
  return (
    <form.Field name={name}>
      {(field: any) => {
        const isInvalid =
          field.state.meta.isTouched && !field.state.meta.isValid;
        return (
          <Field
            data-invalid={isInvalid || undefined}
            orientation="horizontal"
            className={className}
          >
            <div className="flex flex-1 flex-col gap-1">
              <FieldLabel htmlFor={field.name}>
                {label}{' '}
                {required && <span className="text-destructive">*</span>}
              </FieldLabel>
              {description && (
                <FieldDescription>{description}</FieldDescription>
              )}
            </div>
            <Switch
              id={field.name}
              checked={!!field.state.value}
              onCheckedChange={(checked) => field.handleChange(checked)}
              disabled={disabled}
            />
            {isInvalid && <FieldError errors={field.state.meta.errors} />}
          </Field>
        );
      }}
    </form.Field>
  );
}

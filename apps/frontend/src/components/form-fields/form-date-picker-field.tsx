import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { HugeiconsIcon } from '@hugeicons/react';
import { Calendar03Icon } from '@hugeicons/core-free-icons';
import { cn } from '@/lib/utils';
import { Field, FieldLabel, FieldError } from '../ui/field';
import { Button } from '../ui/button';
import { Calendar } from '../ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';

/* eslint-disable @typescript-eslint/no-explicit-any */
interface FormDatePickerFieldProps {
  form: any;
  name: string;
  label: string;
  required?: boolean;
  placeholder?: string;
  disabled?: boolean;
  /** When true, future dates cannot be selected in the calendar. */
  disableFuture?: boolean;
  className?: string;
}

export function FormDatePickerField({
  form,
  name,
  label,
  required = false,
  placeholder = 'Pick a date',
  disabled = false,
  disableFuture = false,
  className,
}: FormDatePickerFieldProps) {
  return (
    <form.Field name={name}>
      {(field: any) => (
        <FormDatePickerFieldInner
          field={field}
          label={label}
          required={required}
          placeholder={placeholder}
          disabled={disabled}
          disableFuture={disableFuture}
          className={className}
        />
      )}
    </form.Field>
  );
}

function FormDatePickerFieldInner({
  field,
  label,
  required,
  placeholder,
  disabled,
  disableFuture,
  className,
}: {
  field: any;
  label: string;
  required: boolean;
  placeholder: string;
  disabled: boolean;
  disableFuture: boolean;
  className?: string;
}) {
  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
  const [open, setOpen] = useState(false);

  const value = field.state.value as string;
  const date = value ? parseISO(value) : undefined;

  return (
    <Field data-invalid={isInvalid || undefined} className={className}>
      <FieldLabel htmlFor={field.name}>
        {label} {required && <span className="text-destructive">*</span>}
      </FieldLabel>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              id={field.name}
              variant="outline"
              disabled={disabled}
              data-empty={!date}
              className={cn(
                'w-full justify-start text-left font-normal',
                'data-[empty=true]:text-muted-foreground',
              )}
            />
          }
        >
          <HugeiconsIcon icon={Calendar03Icon} data-icon="inline-start" />
          {date ? format(date, 'PPP') : <span>{placeholder}</span>}
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={date}
            disabled={disableFuture ? { after: new Date() } : undefined}
            onSelect={(selected) => {
              field.handleChange(
                selected ? format(selected, 'yyyy-MM-dd') : '',
              );
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
      {isInvalid && <FieldError errors={field.state.meta.errors} />}
    </Field>
  );
}

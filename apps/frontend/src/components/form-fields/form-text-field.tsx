import { useState, useEffect, type ChangeEvent, type ReactNode } from 'react';
import { Field, FieldLabel, FieldError } from '../ui/field';
import { Input } from '../ui/input';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '../ui/input-group';

/* eslint-disable @typescript-eslint/no-explicit-any */
interface FormTextFieldProps {
  form: any;
  name: string;
  label: string;
  required?: boolean;
  placeholder?: string;
  autoComplete?: string;
  type?: string;
  disabled?: boolean;
  className?: string;
  /** Optional fixed addon rendered before the input (e.g. a "+251" phone prefix). */
  prefix?: ReactNode;
  /** Transform the stored value into what is displayed in the input. */
  format?: (value: string) => string;
  /** Transform raw user input into the value stored in form state. */
  parse?: (input: string) => string;
  inputMode?:
    | 'text'
    | 'numeric'
    | 'tel'
    | 'decimal'
    | 'email'
    | 'url'
    | 'search'
    | 'none';
  maxLength?: number;
}

export function FormTextField({
  form,
  name,
  label,
  required = false,
  placeholder = '',
  autoComplete,
  type = 'text',
  disabled = false,
  className,
  prefix,
  format,
  parse,
  inputMode,
  maxLength,
}: FormTextFieldProps) {
  return (
    <form.Field name={name}>
      {(field: any) => (
        <FormTextFieldInner
          field={field}
          label={label}
          required={required}
          placeholder={placeholder}
          autoComplete={autoComplete}
          type={type}
          disabled={disabled}
          className={className}
          prefix={prefix}
          format={format}
          parse={parse}
          inputMode={inputMode}
          maxLength={maxLength}
        />
      )}
    </form.Field>
  );
}

function FormTextFieldInner({
  field,
  label,
  required,
  placeholder,
  autoComplete,
  type,
  disabled,
  className,
  prefix,
  format,
  parse,
  inputMode,
  maxLength,
}: {
  field: any;
  label: string;
  required: boolean;
  placeholder: string;
  autoComplete?: string;
  type: string;
  disabled: boolean;
  className?: string;
  prefix?: ReactNode;
  format?: (value: string) => string;
  parse?: (input: string) => string;
  inputMode?:
    | 'text'
    | 'numeric'
    | 'tel'
    | 'decimal'
    | 'email'
    | 'url'
    | 'search'
    | 'none';
  maxLength?: number;
}) {
  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
  const isNumber = type === 'number';
  const [isCleared, setIsCleared] = useState(false);
  const [rawNumberValue, setRawNumberValue] = useState<string>(() => {
    if (!isNumber) return '';
    const value = field.state.value;
    if (value === null || value === undefined || Number.isNaN(value)) return '';
    return String(value);
  });

  useEffect(() => {
    if (!isNumber) return;
    const value = field.state.value;
    if (isCleared && value === 0) return;

    const next =
      value === null || value === undefined || Number.isNaN(value)
        ? ''
        : String(value);

    if (next !== rawNumberValue) setRawNumberValue(next);
    if (isCleared && value !== 0) setIsCleared(false);
  }, [field.state.value, isCleared, isNumber, rawNumberValue]);

  const rawValue = isNumber
    ? isCleared && field.state.value === 0
      ? ''
      : rawNumberValue
    : (field.state.value ?? '');
  const inputValue = !isNumber && format ? format(String(rawValue)) : rawValue;

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (isNumber) {
      const nextValue = e.target.value;
      setRawNumberValue(nextValue);
      if (nextValue === '') {
        setIsCleared(true);
        field.handleChange(0);
        return;
      }
      setIsCleared(false);
      const parsed = Number(nextValue);
      field.handleChange(Number.isNaN(parsed) ? 0 : parsed);
      return;
    }
    field.handleChange(parse ? parse(e.target.value) : e.target.value);
  };

  const sharedInputProps = {
    id: field.name,
    name: field.name,
    type,
    step: isNumber ? ('any' as const) : undefined,
    value: inputValue,
    onBlur: field.handleBlur,
    onChange: handleChange,
    'aria-invalid': isInvalid,
    placeholder,
    autoComplete,
    disabled,
    inputMode,
    maxLength,
  };

  return (
    <Field data-invalid={isInvalid || undefined} className={className}>
      <FieldLabel htmlFor={field.name}>
        {label} {required && <span className="text-destructive">*</span>}
      </FieldLabel>
      {prefix != null ? (
        <InputGroup>
          <InputGroupAddon>{prefix}</InputGroupAddon>
          <InputGroupInput {...sharedInputProps} />
        </InputGroup>
      ) : (
        <Input {...sharedInputProps} />
      )}
      {isInvalid && <FieldError errors={field.state.meta.errors} />}
    </Field>
  );
}

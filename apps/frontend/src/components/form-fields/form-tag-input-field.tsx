import { useState, type KeyboardEvent } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon } from '@hugeicons/core-free-icons';
import { Field, FieldLabel, FieldError } from '../ui/field';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';

/* eslint-disable @typescript-eslint/no-explicit-any */
interface FormTagInputFieldProps {
  form: any;
  name: string;
  label: string;
  required?: boolean;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function FormTagInputField({
  form,
  name,
  label,
  required = false,
  placeholder = '',
  disabled = false,
  className,
}: FormTagInputFieldProps) {
  return (
    <form.Field name={name}>
      {(field: any) => (
        <FormTagInputFieldInner
          field={field}
          label={label}
          required={required}
          placeholder={placeholder}
          disabled={disabled}
          className={className}
        />
      )}
    </form.Field>
  );
}

function FormTagInputFieldInner({
  field,
  label,
  required,
  placeholder,
  disabled,
  className,
}: {
  field: any;
  label: string;
  required: boolean;
  placeholder: string;
  disabled: boolean;
  className?: string;
}) {
  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
  const [inputValue, setInputValue] = useState('');
  const tags: string[] = field.state.value ?? [];

  function addTag(tag: string) {
    const trimmed = tag.trim();
    if (!trimmed || tags.includes(trimmed)) return;
    field.handleChange([...tags, trimmed]);
    setInputValue('');
  }

  function removeTag(index: number) {
    field.handleChange(tags.filter((_: string, i: number) => i !== index));
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag(inputValue);
    } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
      removeTag(tags.length - 1);
    }
  }

  return (
    <Field data-invalid={isInvalid || undefined} className={className}>
      <FieldLabel htmlFor={field.name}>
        {label} {required && <span className="text-destructive">*</span>}
      </FieldLabel>
      <div className="border-input focus-within:border-ring focus-within:ring-ring/50 flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border px-3 py-1.5 shadow-xs focus-within:ring-[3px]">
        {tags.map((tag: string, index: number) => (
          <Badge key={index} variant="secondary" className="gap-1">
            {tag}
            {!disabled && (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="h-3.5 w-3.5"
                onClick={() => removeTag(index)}
              >
                <HugeiconsIcon icon={Cancel01Icon} />
              </Button>
            )}
          </Badge>
        ))}
        <Input
          id={field.name}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            if (inputValue.trim()) addTag(inputValue);
            field.handleBlur();
          }}
          placeholder={tags.length === 0 ? placeholder : ''}
          disabled={disabled}
          className="h-auto min-w-20 flex-1 border-0 p-0 shadow-none focus-visible:ring-0"
        />
      </div>
      {isInvalid && <FieldError errors={field.state.meta.errors} />}
    </Field>
  );
}

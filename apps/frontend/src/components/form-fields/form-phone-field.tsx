import { FormTextField } from './form-text-field';

/* eslint-disable @typescript-eslint/no-explicit-any */
interface FormPhoneFieldProps {
  form: any;
  name: string;
  label: string;
  required?: boolean;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

/** Local subscriber number length (after the +251 country code). */
const LOCAL_LENGTH = 9;
const COUNTRY_CODE = '+251';

/** Stored value (e.g. "+251912345678") -> displayed local digits (e.g. "912345678"). */
function toLocal(value: string): string {
  const digits = (value ?? '').replace(/\D/g, '');
  const local = digits
    .replace(/^251/, '') // strip country code
    .replace(/^0/, ''); // strip national trunk prefix
  return local.slice(0, LOCAL_LENGTH);
}

/** Raw user input -> stored E.164 value. Empty input stays empty (so "required" can flag it). */
function toStored(input: string): string {
  const local = toLocal(input);
  return local ? `${COUNTRY_CODE}${local}` : '';
}

/**
 * Ethiopian phone field: renders a fixed "+251" prefix and accepts a 9-digit
 * local number starting with 7 or 9. Stores the full E.164 value
 * (e.g. "+251912345678") in form state.
 */
export function FormPhoneField({
  form,
  name,
  label,
  required = false,
  placeholder = '9XXXXXXXX',
  disabled = false,
  className,
}: FormPhoneFieldProps) {
  return (
    <FormTextField
      form={form}
      name={name}
      label={label}
      required={required}
      placeholder={placeholder}
      disabled={disabled}
      className={className}
      type="tel"
      inputMode="numeric"
      autoComplete="tel-national"
      maxLength={LOCAL_LENGTH}
      prefix={COUNTRY_CODE}
      format={toLocal}
      parse={toStored}
    />
  );
}

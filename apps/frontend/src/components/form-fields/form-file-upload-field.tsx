import { Field, FieldLabel, FieldError } from '../ui/field';
import { FileUploadField, type UploadedFile } from '../file-upload-component';

/* eslint-disable @typescript-eslint/no-explicit-any */
interface FormFileUploadFieldProps {
  form: any;
  name: string;
  label: string;
  required?: boolean;
  uploadFn: (
    file: File,
    onProgress: (percent: number) => void,
  ) => Promise<UploadedFile>;
  deleteFn?: (url: string) => Promise<void>;
  onPreview?: (file: UploadedFile) => void;
  accept?: string;
  maxFiles?: number;
  maxSize?: number;
  disabled?: boolean;
  className?: string;
}

export function FormFileUploadField({
  form,
  name,
  label,
  required = false,
  uploadFn,
  deleteFn,
  onPreview,
  accept,
  maxFiles = 1,
  maxSize,
  disabled = false,
  className,
}: FormFileUploadFieldProps) {
  return (
    <form.Field name={name}>
      {(field: any) => (
        <FormFileUploadFieldInner
          field={field}
          label={label}
          required={required}
          uploadFn={uploadFn}
          deleteFn={deleteFn}
          onPreview={onPreview}
          accept={accept}
          maxFiles={maxFiles}
          maxSize={maxSize}
          disabled={disabled}
          className={className}
        />
      )}
    </form.Field>
  );
}

function FormFileUploadFieldInner({
  field,
  label,
  required,
  uploadFn,
  deleteFn,
  onPreview,
  accept,
  maxFiles,
  maxSize,
  disabled,
  className,
}: {
  field: any;
  label: string;
  required: boolean;
  uploadFn: (
    file: File,
    onProgress: (percent: number) => void,
  ) => Promise<UploadedFile>;
  deleteFn?: (url: string) => Promise<void>;
  onPreview?: (file: UploadedFile) => void;
  accept?: string;
  maxFiles?: number;
  maxSize?: number;
  disabled?: boolean;
  className?: string;
}) {
  const isInvalid = field.state.meta.isTouched && !field.state.meta.isValid;
  const currentValue: string = field.state.value ?? '';

  // Convert string URL to UploadedFile array for the FileUploadField
  const uploadedFiles: UploadedFile[] = currentValue
    ? [
        {
          url: currentValue,
          originalName: currentValue.split('/').pop() || 'file',
          mimeType: '',
          size: 0,
        },
      ]
    : [];

  const handleValueChange = (files: UploadedFile[]) => {
    if (files.length > 0) {
      field.handleChange(files[files.length - 1].url);
    } else {
      field.handleChange('');
    }
  };

  return (
    <Field data-invalid={isInvalid || undefined} className={className}>
      <FieldLabel htmlFor={field.name}>
        {label} {required && <span className="text-destructive">*</span>}
      </FieldLabel>
      <FileUploadField
        uploadFn={uploadFn}
        deleteFn={deleteFn}
        onPreview={onPreview}
        value={uploadedFiles}
        onValueChange={handleValueChange}
        accept={accept}
        maxFiles={maxFiles}
        maxSize={maxSize}
        disabled={disabled}
      />
      {isInvalid && <FieldError errors={field.state.meta.errors} />}
    </Field>
  );
}

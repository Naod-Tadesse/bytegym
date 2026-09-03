import { Field, FieldLabel, FieldError, FieldDescription } from '../ui/field';
import { FileUploadField, type UploadedFile } from '../file-upload-component';

/* eslint-disable @typescript-eslint/no-explicit-any */
interface FormMultiFileUploadFieldProps {
  form: any;
  name: string;
  label: string;
  description?: string;
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

export function FormMultiFileUploadField({
  form,
  name,
  label,
  description,
  required = false,
  uploadFn,
  deleteFn,
  onPreview,
  accept,
  maxFiles = 10,
  maxSize,
  disabled = false,
  className,
}: FormMultiFileUploadFieldProps) {
  return (
    <form.Field name={name}>
      {(field: any) => (
        <FormMultiFileUploadFieldInner
          field={field}
          label={label}
          description={description}
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

function FormMultiFileUploadFieldInner({
  field,
  label,
  description,
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
  description?: string;
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
  const currentValue: string[] = field.state.value ?? [];

  // Convert string[] URLs to UploadedFile[] for the FileUploadField
  const uploadedFiles: UploadedFile[] = currentValue.map((url: string) => ({
    url,
    originalName: url.split('/').pop() || 'file',
    mimeType: '',
    size: 0,
  }));

  const handleValueChange = (files: UploadedFile[]) => {
    field.handleChange(files.map((f) => f.url));
  };

  return (
    <Field data-invalid={isInvalid || undefined} className={className}>
      <FieldLabel htmlFor={field.name}>
        {label} {required && <span className="text-destructive">*</span>}
      </FieldLabel>
      {description && <FieldDescription>{description}</FieldDescription>}
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

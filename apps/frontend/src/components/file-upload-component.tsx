import { HugeiconsIcon } from '@hugeicons/react';
import {
  Cancel01Icon,
  Delete02Icon,
  File01Icon,
  Upload01Icon,
  ViewIcon,
} from '@hugeicons/core-free-icons';
import * as React from 'react';
import { toast } from '@/components/ui/toast';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import {
  FileUpload,
  FileUploadDropzone,
  FileUploadItem,
  FileUploadItemDelete,
  FileUploadItemMetadata,
  FileUploadItemPreview,
  FileUploadItemProgress,
  FileUploadList,
  FileUploadTrigger,
} from '@/components/ui/file-upload';

export interface UploadedFile {
  url: string;
  originalName: string;
  mimeType: string;
  size: number;
}

export interface FileUploadFieldProps {
  /** Function that performs the upload. Receives File and progress callback. */
  uploadFn: (
    file: File,
    onProgress: (percent: number) => void,
  ) => Promise<UploadedFile>;
  /** Function to delete an uploaded file by URL */
  deleteFn?: (url: string) => Promise<void>;
  /** Called when an uploaded file is clicked for preview */
  onPreview?: (file: UploadedFile) => void;
  /** Already-uploaded files */
  value?: UploadedFile[];
  /** Called when uploaded files change (upload complete or file deleted) */
  onValueChange?: (files: UploadedFile[]) => void;
  /** Comma-separated accept string, e.g. "image/*,.pdf,.doc,.docx" */
  accept?: string;
  /** Max number of files */
  maxFiles?: number;
  /** Max file size in bytes (default 10MB) */
  maxSize?: number;
  /** Disable the upload */
  disabled?: boolean;
  /** Additional className */
  className?: string;
}

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];

function isImageFile(mimeType?: string, url?: string): boolean {
  if (mimeType?.startsWith('image/')) return true;
  if (url) {
    return IMAGE_EXTENSIONS.some((ext) =>
      url.toLowerCase().split('?')[0].endsWith(ext),
    );
  }
  return false;
}

function formatBytes(bytes: number) {
  if (bytes === 0) return '0 B';
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 1024 ** i).toFixed(i ? 1 : 0)} ${sizes[i]}`;
}

function UploadedImageCard({
  file,
  onDelete,
  onPreview,
  disabled,
}: {
  file: UploadedFile;
  onDelete?: (url: string) => Promise<void>;
  onPreview?: (file: UploadedFile) => void;
  disabled?: boolean;
}) {
  const [isDeleting, setIsDeleting] = React.useState(false);

  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!onDelete || isDeleting) return;
    setIsDeleting(true);
    try {
      await onDelete(file.url);
    } catch {
      toast.add({ title: 'Failed to delete file', type: 'error' });
      setIsDeleting(false);
    }
  };

  return (
    <div className="group relative overflow-hidden rounded-lg border bg-accent/30">
      <button
        type="button"
        className="block w-full cursor-pointer"
        onClick={() => onPreview?.(file)}
      >
        <img
          src={file.url}
          alt={file.originalName}
          className="h-40 w-full object-cover transition-opacity group-hover:opacity-80"
        />
      </button>

      {/* Overlay actions */}
      <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/0 opacity-0 transition-all group-hover:bg-black/40 group-hover:opacity-100">
        {onPreview && (
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="size-9"
            onClick={() => onPreview(file)}
          >
            <HugeiconsIcon icon={ViewIcon} className="size-4" />
          </Button>
        )}
        {onDelete && (
          <Button
            type="button"
            variant="destructive"
            size="icon"
            className="size-9"
            disabled={disabled || isDeleting}
            onClick={handleDelete}
          >
            {isDeleting ? (
              <Spinner />
            ) : (
              <HugeiconsIcon icon={Delete02Icon} className="size-4" />
            )}
          </Button>
        )}
      </div>

      {/* File name */}
      <div className="px-2 py-1.5">
        <p className="truncate text-xs text-muted-foreground">
          {file.originalName}
        </p>
      </div>
    </div>
  );
}

function UploadedFileItem({
  file,
  onDelete,
  onPreview,
  disabled,
}: {
  file: UploadedFile;
  onDelete?: (url: string) => Promise<void>;
  onPreview?: (file: UploadedFile) => void;
  disabled?: boolean;
}) {
  const [isDeleting, setIsDeleting] = React.useState(false);
  const isImage = isImageFile(file.mimeType, file.url);

  const handleDelete = async () => {
    if (!onDelete || isDeleting) return;
    setIsDeleting(true);
    try {
      await onDelete(file.url);
    } catch {
      toast.add({ title: 'Failed to delete file', type: 'error' });
      setIsDeleting(false);
    }
  };

  return (
    <div className="relative flex items-center gap-2.5 rounded-md border p-3">
      {/* Preview */}
      <button
        type="button"
        className={cn(
          'relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded border bg-accent/50',
          onPreview &&
            'cursor-pointer ring-offset-background hover:ring-2 hover:ring-ring hover:ring-offset-1 transition-shadow',
        )}
        onClick={() => onPreview?.(file)}
        disabled={!onPreview}
        tabIndex={onPreview ? 0 : -1}
      >
        {isImage ? (
          <img
            src={file.url}
            alt={file.originalName}
            className="size-full object-cover"
          />
        ) : (
          <HugeiconsIcon
            icon={File01Icon}
            className="size-5 text-muted-foreground"
          />
        )}
      </button>

      {/* Metadata */}
      <div
        className={cn(
          'flex min-w-0 flex-1 flex-col',
          onPreview && 'cursor-pointer',
        )}
        onClick={() => onPreview?.(file)}
      >
        <span className="truncate text-sm font-medium">
          {file.originalName}
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {file.size > 0 ? formatBytes(file.size) : ''}
        </span>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-1">
        {onPreview && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            onClick={() => onPreview(file)}
          >
            <HugeiconsIcon icon={ViewIcon} className="size-4" />
          </Button>
        )}
        {onDelete && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-7"
            disabled={disabled || isDeleting}
            onClick={handleDelete}
          >
            {isDeleting ? (
              <Spinner />
            ) : (
              <HugeiconsIcon icon={Delete02Icon} className="size-4" />
            )}
          </Button>
        )}
      </div>
    </div>
  );
}

export function FileUploadField({
  uploadFn,
  deleteFn,
  onPreview,
  value = [],
  onValueChange,
  accept,
  maxFiles = 1,
  maxSize = 10 * 1024 * 1024,
  disabled = false,
  className,
}: FileUploadFieldProps) {
  const [pendingFiles, setPendingFiles] = React.useState<File[]>([]);

  const uploadedFiles = value;
  const totalSlots = maxFiles;
  const usedSlots = uploadedFiles.length;
  const canUploadMore = usedSlots < totalSlots;

  // Check if all uploaded files are images (for grid display)
  const allImages =
    uploadedFiles.length > 0 &&
    uploadedFiles.every((f) => isImageFile(f.mimeType, f.url));
  const useGrid = allImages && maxFiles > 1;

  const onFileReject = React.useCallback((file: File, message: string) => {
    toast.add({
      title: message,
      description: `"${file.name.length > 20 ? `${file.name.slice(0, 20)}...` : file.name}" has been rejected`,
      type: 'error',
    });
  }, []);

  const handleUpload = React.useCallback(
    async (
      files: File[],
      options: {
        onProgress: (file: File, progress: number) => void;
        onSuccess: (file: File) => void;
        onError: (file: File, error: Error) => void;
      },
    ) => {
      for (const file of files) {
        try {
          const result = await uploadFn(file, (percent) => {
            options.onProgress(file, percent);
          });
          options.onSuccess(file);

          // Add to uploaded files
          const newUploaded = [
            ...(onValueChange ? value : uploadedFiles),
            result,
          ];
          onValueChange?.(newUploaded);

          // Remove from pending
          setPendingFiles((prev) => prev.filter((f) => f !== file));
        } catch (err) {
          options.onError(
            file,
            err instanceof Error ? err : new Error('Upload failed'),
          );
        }
      }
    },
    [uploadFn, onValueChange, value, uploadedFiles],
  );

  const handleDelete = React.useCallback(
    async (url: string) => {
      if (deleteFn) {
        await deleteFn(url);
      }
      const newUploaded = uploadedFiles.filter((f) => f.url !== url);
      onValueChange?.(newUploaded);
    },
    [deleteFn, uploadedFiles, onValueChange],
  );

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {/* Dropzone for new uploads */}
      {canUploadMore && (
        <FileUpload
          maxFiles={totalSlots - usedSlots}
          maxSize={maxSize}
          accept={accept}
          className="w-full"
          value={pendingFiles}
          onValueChange={setPendingFiles}
          onFileReject={onFileReject}
          onUpload={handleUpload}
          disabled={disabled}
          multiple={totalSlots - usedSlots > 1}
        >
          <FileUploadDropzone className="min-h-0 p-4">
            <div className="flex flex-col items-center gap-1 text-center">
              <div className="flex items-center justify-center rounded-full border p-2">
                <HugeiconsIcon
                  icon={Upload01Icon}
                  className="size-5 text-muted-foreground"
                />
              </div>
              <p className="text-sm font-medium">
                Drag & drop or click to browse
              </p>
              <p className="text-xs text-muted-foreground">
                Max {formatBytes(maxSize)} per file
              </p>
            </div>
            <FileUploadTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2 w-fit"
              >
                Browse files
              </Button>
            </FileUploadTrigger>
          </FileUploadDropzone>

          {/* Pending/uploading files */}
          <FileUploadList>
            {pendingFiles.map((file, index) => (
              <FileUploadItem key={index} value={file}>
                <FileUploadItemPreview />
                <FileUploadItemMetadata />
                <FileUploadItemProgress />
                <FileUploadItemDelete asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7"
                  >
                    <HugeiconsIcon icon={Cancel01Icon} className="size-4" />
                  </Button>
                </FileUploadItemDelete>
              </FileUploadItem>
            ))}
          </FileUploadList>
        </FileUpload>
      )}

      {/* Already uploaded files — grid for images, list for documents */}
      {uploadedFiles.length > 0 && useGrid && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {uploadedFiles.map((file) => (
            <UploadedImageCard
              key={file.url}
              file={file}
              onDelete={deleteFn ? handleDelete : undefined}
              onPreview={onPreview}
              disabled={disabled}
            />
          ))}
        </div>
      )}

      {uploadedFiles.length > 0 && !useGrid && (
        <div className="flex flex-col gap-2">
          {uploadedFiles.map((file) => (
            <UploadedFileItem
              key={file.url}
              file={file}
              onDelete={deleteFn ? handleDelete : undefined}
              onPreview={onPreview}
              disabled={disabled}
            />
          ))}
        </div>
      )}
    </div>
  );
}

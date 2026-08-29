import { motion } from 'framer-motion';
import { ImageOff, UploadCloud } from 'lucide-react';
import { useRef, useState, type DragEvent } from 'react';
import { cn, formatBytes } from '../../lib/utils';
import { GradientButton } from '../ui/GradientButton';
import { Spinner } from '../ui/Spinner';
import { useUploadLogo } from '../../hooks/useBrandKits';

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

interface LogoUploaderProps {
  brandKitId: number;
  currentLogoUrl: string | null;
}

function validate(file: File): string | null {
  if (!file.type.startsWith('image/')) {
    return 'Only image files are supported.';
  }
  if (file.size > MAX_BYTES) {
    return `Image is ${formatBytes(file.size)} — the limit is 5 MB.`;
  }
  return null;
}

/** Image dropzone for a brand kit logo / watermark. */
export function LogoUploader({ brandKitId, currentLogoUrl }: LogoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [pending, setPending] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const uploadLogo = useUploadLogo(brandKitId);

  const accept = (file: File | undefined): void => {
    if (!file) {
      return;
    }
    const validationError = validate(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setPending(file);
    setPreviewUrl((old) => {
      if (old) {
        URL.revokeObjectURL(old);
      }
      return URL.createObjectURL(file);
    });
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    setIsDragging(false);
    accept(event.dataTransfer.files[0]);
  };

  const handleUpload = async (): Promise<void> => {
    if (!pending) {
      return;
    }
    setError(null);
    try {
      await uploadLogo.mutateAsync(pending);
      setPending(null);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      setPreviewUrl(null);
      if (inputRef.current) {
        inputRef.current.value = '';
      }
    } catch {
      setError('The logo upload failed. Please try again.');
    }
  };

  const shownImage = previewUrl ?? currentLogoUrl;

  return (
    <div className="space-y-3">
      <motion.div
        whileHover={{ scale: 1.01 }}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-colors',
          isDragging
            ? 'border-brand-500 bg-brand-50'
            : 'border-slate-300 bg-white/60',
        )}
      >
        {shownImage ? (
          <img
            src={shownImage}
            alt="Brand kit logo"
            className="max-h-28 w-auto rounded-lg object-contain"
          />
        ) : (
          <span className="rounded-full bg-brand-100 p-3 text-brand-600">
            <ImageOff size={24} />
          </span>
        )}
        <p className="flex items-center gap-2 text-sm font-medium text-slate-700">
          <UploadCloud size={16} />
          Drop an image, or click to browse
        </p>
        <p className="text-xs text-slate-500">PNG, JPG, SVG — up to 5 MB</p>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => accept(event.target.files?.[0])}
        />
      </motion.div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {pending && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5">
          <span className="truncate text-sm text-slate-700">
            {pending.name}{' '}
            <span className="text-xs text-slate-500">
              ({formatBytes(pending.size)})
            </span>
          </span>
          <GradientButton
            type="button"
            onClick={handleUpload}
            isLoading={uploadLogo.isPending}
            className="px-4 py-2 text-sm"
          >
            {uploadLogo.isPending ? <Spinner size={16} /> : 'Upload'}
          </GradientButton>
        </div>
      )}
    </div>
  );
}

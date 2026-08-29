import { motion } from 'framer-motion';
import { FileVideo, UploadCloud, X } from 'lucide-react';
import { useRef, useState, type DragEvent } from 'react';
import { formatBytes, cn } from '../../lib/utils';

const MAX_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB

interface FileDropzoneProps {
  file: File | null;
  onFileSelected: (file: File | null) => void;
  disabled?: boolean;
}

function validate(file: File): string | null {
  if (!file.type.startsWith('video/')) {
    return 'Only video files are supported.';
  }
  if (file.size > MAX_BYTES) {
    return `File is ${formatBytes(file.size)} — the limit is 2 GB.`;
  }
  return null;
}

export function FileDropzone({
  file,
  onFileSelected,
  disabled = false,
}: FileDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept = (candidate: File | undefined): void => {
    if (!candidate) {
      return;
    }
    const validationError = validate(candidate);
    if (validationError) {
      setError(validationError);
      onFileSelected(null);
      return;
    }
    setError(null);
    onFileSelected(candidate);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>): void => {
    event.preventDefault();
    setIsDragging(false);
    if (disabled) {
      return;
    }
    accept(event.dataTransfer.files[0]);
  };

  const clear = (): void => {
    setError(null);
    onFileSelected(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  return (
    <div>
      <motion.div
        whileHover={disabled ? undefined : { scale: 1.01 }}
        onClick={() => !disabled && inputRef.current?.click()}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) {
            setIsDragging(true);
          }
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors',
          isDragging
            ? 'border-brand-500 bg-brand-50'
            : 'border-slate-300 bg-white/60',
          disabled && 'cursor-not-allowed opacity-60',
        )}
      >
        <span className="rounded-full bg-brand-100 p-3 text-brand-600">
          <UploadCloud size={26} />
        </span>
        <p className="text-sm font-medium text-slate-700">
          Drag a video here, or click to browse
        </p>
        <p className="text-xs text-slate-500">MP4, MOV, WebM — up to 2 GB</p>
        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          className="hidden"
          disabled={disabled}
          onChange={(event) => accept(event.target.files?.[0])}
        />
      </motion.div>

      {error && <p className="mt-2 text-sm text-red-500">{error}</p>}

      {file && (
        <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
          <span className="flex min-w-0 items-center gap-2">
            <FileVideo size={18} className="shrink-0 text-brand-600" />
            <span className="truncate text-sm text-slate-700">{file.name}</span>
          </span>
          <span className="flex shrink-0 items-center gap-3">
            <span className="text-xs text-slate-500">
              {formatBytes(file.size)}
            </span>
            <button
              type="button"
              onClick={clear}
              aria-label="Remove file"
              className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              <X size={16} />
            </button>
          </span>
        </div>
      )}
    </div>
  );
}

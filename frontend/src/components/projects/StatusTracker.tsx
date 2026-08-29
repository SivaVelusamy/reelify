import { motion } from 'framer-motion';
import { AlertTriangle, Check } from 'lucide-react';
import { useState } from 'react';
import { GradientButton } from '../ui/GradientButton';
import { Spinner } from '../ui/Spinner';
import { useReprocessVideo } from '../../hooks/useSourceVideo';
import { cn } from '../../lib/utils';
import type { SourceVideoStatus } from '../../types';

interface StatusTrackerProps {
  videoId: number;
  status: SourceVideoStatus;
  errorMessage?: string | null;
}

const STEPS: readonly { key: SourceVideoStatus; label: string }[] = [
  { key: 'queued', label: 'Queued' },
  { key: 'transcribing', label: 'Transcribing' },
  { key: 'analyzing', label: 'Analyzing' },
  { key: 'clipping', label: 'Clipping' },
  { key: 'ready', label: 'Ready' },
];

export function StatusTracker({
  videoId,
  status,
  errorMessage,
}: StatusTrackerProps) {
  const [retryError, setRetryError] = useState<string | null>(null);
  const reprocess = useReprocessVideo();

  const activeIndex = STEPS.findIndex((step) => step.key === status);

  const handleRetry = async (): Promise<void> => {
    setRetryError(null);
    try {
      await reprocess.mutateAsync(videoId);
    } catch {
      setRetryError('Could not restart processing. Please try again.');
    }
  };

  if (status === 'failed') {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
        <div className="flex items-start gap-3">
          <span className="rounded-full bg-red-100 p-2 text-red-600">
            <AlertTriangle size={20} />
          </span>
          <div className="flex-1">
            <h3 className="font-semibold text-red-800">Processing failed</h3>
            <p className="mt-1 text-sm text-red-700">
              {errorMessage || 'The pipeline stopped unexpectedly.'}
            </p>
            {retryError && (
              <p className="mt-2 text-sm text-red-600">{retryError}</p>
            )}
            <div className="mt-4">
              <GradientButton
                type="button"
                onClick={handleRetry}
                isLoading={reprocess.isPending}
              >
                Retry
              </GradientButton>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/70 p-6">
      <ol className="flex flex-wrap items-center gap-y-4">
        {STEPS.map((step, index) => {
          const isComplete = activeIndex > index;
          const isCurrent = activeIndex === index;
          return (
            <li key={step.key} className="flex flex-1 items-center gap-3">
              <div className="flex flex-col items-center gap-1">
                <motion.span
                  initial={false}
                  animate={{ scale: isCurrent ? 1.1 : 1 }}
                  className={cn(
                    'flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-semibold',
                    isComplete &&
                      'border-emerald-500 bg-emerald-500 text-white',
                    isCurrent &&
                      'border-brand-500 bg-brand-50 text-brand-600',
                    !isComplete &&
                      !isCurrent &&
                      'border-slate-200 bg-white text-slate-400',
                  )}
                >
                  {isComplete ? (
                    <Check size={16} />
                  ) : isCurrent && step.key !== 'ready' ? (
                    <Spinner size={16} />
                  ) : (
                    index + 1
                  )}
                </motion.span>
                <span
                  className={cn(
                    'text-xs font-medium',
                    isCurrent ? 'text-brand-600' : 'text-slate-500',
                  )}
                >
                  {step.label}
                </span>
              </div>
              {index < STEPS.length - 1 && (
                <span
                  className={cn(
                    'h-0.5 flex-1 rounded-full',
                    isComplete ? 'bg-emerald-500' : 'bg-slate-200',
                  )}
                />
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

type BadgeTone = 'neutral' | 'info' | 'progress' | 'success' | 'warning' | 'danger';

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: 'bg-slate-100 text-slate-700 border-slate-200',
  info: 'bg-blue-100 text-blue-700 border-blue-200',
  progress: 'bg-brand-100 text-brand-700 border-brand-200',
  success: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  warning: 'bg-amber-100 text-amber-700 border-amber-200',
  danger: 'bg-red-100 text-red-700 border-red-200',
};

// Maps every pipeline / job status string from the PRP to a visual tone.
const STATUS_TONE: Record<string, BadgeTone> = {
  // SourceVideo
  queued: 'neutral',
  transcribing: 'progress',
  analyzing: 'progress',
  clipping: 'progress',
  ready: 'success',
  failed: 'danger',
  // Clip
  suggested: 'info',
  draft: 'neutral',
  rendered: 'success',
  archived: 'neutral',
  // ClipExport / DownloadBundle
  rendering: 'progress',
  // BatchUpload
  processing: 'progress',
  completed: 'success',
  // SocialAccount
  connected: 'success',
  expired: 'warning',
  revoked: 'danger',
  // PublishJob
  scheduled: 'info',
  publishing: 'progress',
  published: 'success',
  // Subscription
  active: 'success',
  trialing: 'info',
  past_due: 'warning',
  canceled: 'danger',
  incomplete: 'warning',
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const tone = STATUS_TONE[status] ?? 'neutral';
  const label = status.replace(/_/g, ' ');

  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize',
        TONE_CLASSES[tone],
        className,
      )}
    >
      {label}
    </motion.span>
  );
}

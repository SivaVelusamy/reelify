import { useState } from 'react';
import { CalendarClock, Check, Copy, ExternalLink, Pencil, Trash2 } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { GradientButton } from '../ui/GradientButton';
import { StatusBadge } from '../ui/StatusBadge';
import { Modal } from '../ui/Modal';
import { SchedulePicker } from './SchedulePicker';
import {
  useCancelPublishJob,
  useUpdatePublishJob,
} from '../../hooks/usePublishing';
import { PLATFORM_LABELS } from '../../types/publishing';
import type { PublishJob } from '../../types/publishing';
import { formatRelative } from '../../lib/utils';

interface PublishJobRowProps {
  job: PublishJob;
}

const EDITABLE_STATUSES = new Set(['draft', 'scheduled']);

async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through */
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

export function PublishJobRow({ job }: PublishJobRowProps) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [scheduledAt, setScheduledAt] = useState<string | null>(
    job.scheduled_at,
  );
  const [caption, setCaption] = useState(job.caption_text ?? '');
  const [error, setError] = useState<string | null>(null);

  const updateJob = useUpdatePublishJob();
  const cancelJob = useCancelPublishJob();

  const canEdit = EDITABLE_STATUSES.has(job.status);

  let destinationLabel: string;
  if (job.platform) {
    destinationLabel = PLATFORM_LABELS[job.platform];
  } else if (job.destination_type === 'slack' || job.destination_type === 'teams') {
    destinationLabel = PLATFORM_LABELS[job.destination_type];
  } else if (job.destination_type === 'link') {
    destinationLabel = 'Share link';
  } else {
    destinationLabel = 'Social account';
  }

  const handleSave = async (): Promise<void> => {
    setError(null);
    try {
      await updateJob.mutateAsync({
        id: job.id,
        input: {
          scheduled_at: scheduledAt,
          caption_text: caption.trim() ? caption.trim() : null,
        },
      });
      setIsEditOpen(false);
    } catch {
      setError('Could not update this job. Please try again.');
    }
  };

  const handleCancel = async (): Promise<void> => {
    setError(null);
    try {
      await cancelJob.mutateAsync(job.id);
      setIsCancelOpen(false);
    } catch {
      setError('Could not cancel this job. Please try again.');
    }
  };

  return (
    <GlassCard className="mb-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900">
            {job.clip_title ?? `Clip #${job.clip_id}`}
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
            <CalendarClock size={13} />
            {destinationLabel}
            {job.scheduled_at
              ? ` · scheduled ${formatRelative(job.scheduled_at)}`
              : job.published_at
                ? ` · published ${formatRelative(job.published_at)}`
                : ''}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <StatusBadge status={job.status} />
          {canEdit && (
            <>
              <button
                type="button"
                onClick={() => setIsEditOpen(true)}
                aria-label="Reschedule job"
                className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
              >
                <Pencil size={15} />
              </button>
              <button
                type="button"
                onClick={() => setIsCancelOpen(true)}
                aria-label="Cancel job"
                className="rounded-full p-1.5 text-red-500 hover:bg-red-50"
              >
                <Trash2 size={15} />
              </button>
            </>
          )}
        </div>
      </div>

      {job.status === 'failed' && job.error_message && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
          {job.error_message}
        </p>
      )}

      {job.share_url && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
          <input
            readOnly
            value={job.share_url}
            aria-label="Public share link"
            onFocus={(event) => event.currentTarget.select()}
            className="min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700"
          />
          <button
            type="button"
            onClick={() => {
              void copyText(job.share_url as string).then(setCopied);
            }}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <a
            href={job.share_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50"
          >
            <ExternalLink size={13} />
            Open
          </a>
        </div>
      )}

      <Modal
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        title="Reschedule job"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsEditOpen(false)}
              className="rounded-full px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <GradientButton
              type="button"
              onClick={() => void handleSave()}
              isLoading={updateJob.isPending}
            >
              Save
            </GradientButton>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor={`job-caption-${job.id}`}
              className="text-sm font-medium text-slate-700"
            >
              Caption
            </label>
            <textarea
              id={`job-caption-${job.id}`}
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
              rows={3}
              className="rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
            />
          </div>
          <SchedulePicker value={scheduledAt} onChange={setScheduledAt} />
          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
        </div>
      </Modal>

      <Modal
        isOpen={isCancelOpen}
        onClose={() => setIsCancelOpen(false)}
        title="Cancel this job?"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsCancelOpen(false)}
              className="rounded-full px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
            >
              Keep it
            </button>
            <GradientButton
              type="button"
              onClick={() => void handleCancel()}
              isLoading={cancelJob.isPending}
            >
              Cancel job
            </GradientButton>
          </>
        }
      >
        <p>This publish job will be removed and will not run.</p>
        {error && (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
      </Modal>
    </GlassCard>
  );
}

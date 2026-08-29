import { Link } from 'react-router-dom';
import { Film } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { StatusBadge } from '../ui/StatusBadge';
import { ScoreBadge } from './ScoreBadge';
import { formatDuration } from '../../lib/utils';
import type { Clip } from '../../types';

interface ClipCardProps {
  clip: Clip;
}

export function ClipCard({ clip }: ClipCardProps) {
  const duration = Math.max(clip.end_seconds - clip.start_seconds, 0);

  return (
    <GlassCard className="mb-4 p-4">
      <div className="flex gap-4">
        <div className="flex h-24 w-16 flex-none items-center justify-center rounded-xl bg-slate-900/80 text-slate-300">
          <Film size={22} />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-start justify-between gap-3">
            <h3 className="truncate text-base font-semibold text-slate-900">
              {clip.title || `Clip #${clip.rank}`}
            </h3>
            <StatusBadge status={clip.status} />
          </div>

          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <span>{formatDuration(duration)}</span>
            <span aria-hidden="true">•</span>
            <span>{clip.aspect_ratio}</span>
            <ScoreBadge score={clip.score} />
          </div>

          <div className="mt-1">
            <Link
              to={`/clips/${clip.id}/edit`}
              className="inline-flex items-center rounded-full border border-brand-200 px-4 py-1.5 text-sm font-semibold text-brand-700 transition-colors hover:bg-brand-50"
            >
              Edit clip
            </Link>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

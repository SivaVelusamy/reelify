import { Link } from 'react-router-dom';
import { Film } from 'lucide-react';
import { formatDuration } from '../../lib/utils';
import type { LibraryClip } from '../../types/library';
import { GlassCard } from '../ui/GlassCard';
import { StatusBadge } from '../ui/StatusBadge';

interface ClipGridProps {
  clips: LibraryClip[];
  selectedIds: number[];
  onToggleSelect: (clipId: number) => void;
}

/** Responsive grid of library clip cards with bundle-selection checkboxes. */
export function ClipGrid({ clips, selectedIds, onToggleSelect }: ClipGridProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {clips.map((clip) => (
        <LibraryClipCard
          key={clip.id}
          clip={clip}
          selected={selectedIds.includes(clip.id)}
          onToggleSelect={() => onToggleSelect(clip.id)}
        />
      ))}
    </div>
  );
}

interface LibraryClipCardProps {
  clip: LibraryClip;
  selected: boolean;
  onToggleSelect: () => void;
}

function LibraryClipCard({
  clip,
  selected,
  onToggleSelect,
}: LibraryClipCardProps) {
  const duration = Math.max(clip.end_seconds - clip.start_seconds, 0);

  return (
    <GlassCard className="flex flex-col gap-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-16 w-12 flex-none items-center justify-center rounded-lg bg-slate-900/80 text-slate-300">
          <Film size={18} />
        </div>
        <label className="flex items-center gap-2 text-xs font-medium text-slate-500">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          />
          Select
        </label>
      </div>

      <div className="flex items-start justify-between gap-2">
        <h3 className="truncate text-sm font-semibold text-slate-900">
          {clip.title || `Clip #${clip.rank}`}
        </h3>
        <StatusBadge status={clip.status} />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <span>{formatDuration(duration)}</span>
        <span aria-hidden="true">•</span>
        <span>{clip.aspect_ratio}</span>
        <span aria-hidden="true">•</span>
        <span className="truncate">{clip.project_title}</span>
      </div>

      {clip.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {clip.tags.map((tag) => (
            <span
              key={tag.id}
              className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-600"
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: tag.color }}
              />
              {tag.name}
            </span>
          ))}
        </div>
      )}

      <div className="mt-1 flex flex-wrap gap-2">
        <Link
          to={`/library/clips/${clip.id}`}
          className="inline-flex w-fit items-center rounded-full border border-brand-200 px-4 py-1.5 text-xs font-semibold text-brand-700 transition-colors hover:bg-brand-50"
        >
          Open
        </Link>
        <Link
          to={`/clips/${clip.id}/publish`}
          className="inline-flex w-fit items-center rounded-full border border-slate-200 px-4 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100"
        >
          Publish
        </Link>
      </div>
    </GlassCard>
  );
}

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Film,
  FolderPlus,
  Scissors,
  Send,
  UploadCloud,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import { AnimatedList } from '../ui/AnimatedList';
import { EmptyState } from '../ui/EmptyState';
import { GlassCard } from '../ui/GlassCard';
import { GradientButton } from '../ui/GradientButton';
import { Spinner } from '../ui/Spinner';
import { useActivityFeed } from '../../hooks/useDashboard';
import { formatRelative } from '../../lib/utils';
import type { ActivityItem, ActivityType } from '../../types/dashboard';

const PER_PAGE = 20;

interface TypeVisual {
  icon: LucideIcon;
  className: string;
}

const TYPE_VISUALS: Record<string, TypeVisual> = {
  video_uploaded: { icon: UploadCloud, className: 'bg-blue-100 text-blue-600' },
  video_ready: { icon: CheckCircle2, className: 'bg-emerald-100 text-emerald-600' },
  video_failed: { icon: XCircle, className: 'bg-red-100 text-red-600' },
  clip_generated: { icon: Scissors, className: 'bg-brand-100 text-brand-600' },
  publish_published: { icon: Send, className: 'bg-emerald-100 text-emerald-600' },
  publish_failed: { icon: AlertTriangle, className: 'bg-red-100 text-red-600' },
  project_created: { icon: FolderPlus, className: 'bg-slate-100 text-slate-600' },
};

const FALLBACK_VISUAL: TypeVisual = {
  icon: Film,
  className: 'bg-slate-100 text-slate-600',
};

function visualFor(type: ActivityType): TypeVisual {
  return TYPE_VISUALS[type] ?? FALLBACK_VISUAL;
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const { icon: Icon, className } = visualFor(item.type);
  return (
    <div className="flex items-start gap-3 border-b border-slate-100 py-3 last:border-0">
      <span className={`mt-0.5 rounded-full p-2 ${className}`}>
        <Icon size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-800">
          {item.title}
        </p>
        <p className="text-xs text-slate-500">
          {formatRelative(item.timestamp)}
        </p>
      </div>
    </div>
  );
}

export function ActivityFeed() {
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<ActivityItem[]>([]);
  const { data, isLoading, isError, isFetching, refetch } = useActivityFeed(
    page,
    PER_PAGE,
  );

  useEffect(() => {
    if (!data) {
      return;
    }
    setItems((prev) => {
      if (data.page === 1) {
        return data.items;
      }
      const seen = new Set(prev.map((entry) => entry.id));
      return [...prev, ...data.items.filter((entry) => !seen.has(entry.id))];
    });
  }, [data]);

  const total = data?.total ?? 0;
  const hasMore = useMemo(() => items.length < total, [items.length, total]);

  if (isLoading && items.length === 0) {
    return (
      <GlassCard>
        <div className="flex justify-center py-10">
          <Spinner size={28} />
        </div>
      </GlassCard>
    );
  }

  if (isError && items.length === 0) {
    return (
      <GlassCard>
        <EmptyState
          icon={AlertTriangle}
          title="Could not load activity"
          description="Something went wrong while fetching your recent activity."
          action={
            <GradientButton type="button" onClick={() => void refetch()}>
              Try again
            </GradientButton>
          }
        />
      </GlassCard>
    );
  }

  if (items.length === 0) {
    return (
      <GlassCard>
        <EmptyState
          title="No activity yet"
          description="Upload a video to see processing and publishing events here."
        />
      </GlassCard>
    );
  }

  return (
    <GlassCard className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold text-slate-900">Recent activity</h2>
      <AnimatedList>
        {items.map((item) => (
          <ActivityRow key={item.id} item={item} />
        ))}
      </AnimatedList>
      {hasMore && (
        <div className="flex justify-center pt-2">
          <GradientButton
            type="button"
            isLoading={isFetching}
            onClick={() => setPage((current) => current + 1)}
          >
            Load more
          </GradientButton>
        </div>
      )}
    </GlassCard>
  );
}

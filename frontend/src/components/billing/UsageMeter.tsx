import { AlertTriangle } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { cn, formatBytes } from '../../lib/utils';
import type { Usage } from '../../types/billing';

interface UsageMeterProps {
  usage: Usage;
}

export function UsageMeter({ usage }: UsageMeterProps) {
  const {
    minutes_processed,
    minutes_limit,
    clips_generated,
    storage_bytes,
    over_limit,
  } = usage;

  const pct =
    minutes_limit > 0
      ? Math.min(100, Math.round((minutes_processed / minutes_limit) * 100))
      : 0;

  return (
    <GlassCard>
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
        Usage this period
      </h2>

      {over_limit && (
        <div
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
          <span>
            You have used all {minutes_limit} minutes on your plan. New clips are
            paused until you upgrade or your period resets.
          </span>
        </div>
      )}

      <div className="mt-4">
        <div className="flex items-baseline justify-between text-sm">
          <span className="font-medium text-slate-700">Minutes processed</span>
          <span className="text-slate-500">
            {minutes_processed} / {minutes_limit}
          </span>
        </div>
        <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              over_limit ? 'bg-red-500' : 'bg-brand-500',
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-4">
        <div className="rounded-xl bg-white/60 px-4 py-3">
          <dt className="text-xs uppercase tracking-wide text-slate-500">
            Clips generated
          </dt>
          <dd className="mt-1 text-xl font-semibold text-slate-900">
            {clips_generated}
          </dd>
        </div>
        <div className="rounded-xl bg-white/60 px-4 py-3">
          <dt className="text-xs uppercase tracking-wide text-slate-500">
            Storage used
          </dt>
          <dd className="mt-1 text-xl font-semibold text-slate-900">
            {formatBytes(storage_bytes)}
          </dd>
        </div>
      </dl>
    </GlassCard>
  );
}

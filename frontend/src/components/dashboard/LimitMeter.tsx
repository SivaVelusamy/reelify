import { motion } from 'framer-motion';
import { GlassCard } from '../ui/GlassCard';
import { cn } from '../../lib/utils';

interface LimitMeterProps {
  minutesUsed: number;
  minutesLimit: number | null;
  usedPct: number;
  className?: string;
}

interface Threshold {
  bar: string;
  text: string;
}

function toneFor(pct: number): Threshold {
  if (pct >= 90) {
    return { bar: 'bg-red-500', text: 'text-red-600' };
  }
  if (pct >= 70) {
    return { bar: 'bg-amber-500', text: 'text-amber-600' };
  }
  return { bar: 'bg-emerald-500', text: 'text-emerald-600' };
}

export function LimitMeter({
  minutesUsed,
  minutesLimit,
  usedPct,
  className,
}: LimitMeterProps) {
  const clampedPct = Math.max(0, Math.min(100, Math.round(usedPct)));
  const tone = toneFor(clampedPct);
  const roundedUsed = Math.round(minutesUsed);

  return (
    <GlassCard className={cn('flex flex-col gap-3', className)}>
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-medium text-slate-500">Minutes this period</p>
        {minutesLimit === null ? (
          <p className="text-sm font-semibold text-brand-600">Unlimited</p>
        ) : (
          <p className={cn('text-sm font-semibold', tone.text)}>{clampedPct}%</p>
        )}
      </div>

      {minutesLimit === null ? (
        <p className="text-2xl font-bold text-slate-900">
          {roundedUsed.toLocaleString()} min
        </p>
      ) : (
        <>
          <p className="text-sm text-slate-700">
            <span className="font-semibold text-slate-900">
              {roundedUsed.toLocaleString()}
            </span>{' '}
            / {minutesLimit.toLocaleString()} min
          </p>
          <div
            className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200"
            role="progressbar"
            aria-valuenow={clampedPct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <motion.div
              className={cn('h-full rounded-full', tone.bar)}
              initial={{ width: 0 }}
              animate={{ width: `${clampedPct}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          </div>
        </>
      )}
    </GlassCard>
  );
}

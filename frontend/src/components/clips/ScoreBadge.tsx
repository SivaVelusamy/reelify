import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import type { ScoreLabel } from '../../types/clips';

interface ScoreBadgeProps {
  /** Model confidence score in the range 0..1. */
  score: number;
  className?: string;
}

interface Tier {
  label: ScoreLabel;
  classes: string;
}

function tierForScore(score: number): Tier {
  const clamped = Number.isFinite(score) ? Math.min(Math.max(score, 0), 1) : 0;
  if (clamped >= 0.85) {
    return { label: 'Top', classes: 'bg-brand-100 text-brand-700 border-brand-200' };
  }
  if (clamped >= 0.65) {
    return {
      label: 'High',
      classes: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    };
  }
  if (clamped >= 0.4) {
    return {
      label: 'Medium',
      classes: 'bg-amber-100 text-amber-700 border-amber-200',
    };
  }
  return { label: 'Low', classes: 'bg-slate-100 text-slate-600 border-slate-200' };
}

export function ScoreBadge({ score, className }: ScoreBadgeProps) {
  const tier = tierForScore(score);
  const pct = Math.round((Number.isFinite(score) ? score : 0) * 100);

  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      title={`Score ${pct}%`}
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold',
        tier.classes,
        className,
      )}
    >
      {tier.label}
      <span className="font-normal opacity-70">{pct}%</span>
    </motion.span>
  );
}

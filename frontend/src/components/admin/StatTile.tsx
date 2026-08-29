import { motion } from 'framer-motion';
import type { LucideIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

interface StatTileProps {
  label: string;
  value: string | number;
  /** Optional secondary line, e.g. "+12 this month". */
  delta?: string;
  /** Tone of the delta line. */
  deltaTone?: 'positive' | 'negative' | 'neutral';
  icon?: LucideIcon;
  className?: string;
}

const DELTA_CLASSES: Record<
  NonNullable<StatTileProps['deltaTone']>,
  string
> = {
  positive: 'text-emerald-600',
  negative: 'text-red-600',
  neutral: 'text-slate-500',
};

export function StatTile({
  label,
  value,
  delta,
  deltaTone = 'neutral',
  icon: Icon,
  className,
}: StatTileProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'flex flex-col gap-1 rounded-2xl border border-white/40 bg-white/70 p-5 shadow-lg backdrop-blur-lg',
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-500">{label}</span>
        {Icon && <Icon size={18} className="text-brand-500" />}
      </div>
      <span className="text-2xl font-bold text-slate-900">{value}</span>
      {delta && (
        <span className={cn('text-xs font-medium', DELTA_CLASSES[deltaTone])}>
          {delta}
        </span>
      )}
    </motion.div>
  );
}

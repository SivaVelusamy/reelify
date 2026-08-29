import type { LucideIcon } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { cn } from '../../lib/utils';

interface UsageStatCardProps {
  label: string;
  value: string;
  subLine?: string;
  icon?: LucideIcon;
  className?: string;
}

export function UsageStatCard({
  label,
  value,
  subLine,
  icon: Icon,
  className,
}: UsageStatCardProps) {
  return (
    <GlassCard className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        {Icon && (
          <span className="rounded-full bg-brand-100 p-2 text-brand-600">
            <Icon size={18} />
          </span>
        )}
      </div>
      <p className="text-3xl font-bold tracking-tight text-slate-900">{value}</p>
      {subLine && <p className="text-xs text-slate-500">{subLine}</p>}
    </GlassCard>
  );
}

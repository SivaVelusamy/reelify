import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import type { JobQueueHealth, QueueCounts } from '../../types/admin';

interface QueueHealthPanelProps {
  data: JobQueueHealth;
}

const QUEUE_LABELS: Record<keyof Omit<JobQueueHealth, 'broker_reachable'>, string> =
  {
    pipeline: 'Pipeline',
    render: 'Render',
    publish: 'Publish',
  };

interface CountCellProps {
  label: string;
  value: number;
  danger?: boolean;
}

function CountCell({ label, value, danger = false }: CountCellProps) {
  const highlight = danger && value > 0;
  return (
    <div
      className={cn(
        'flex flex-col rounded-xl border px-3 py-2',
        highlight
          ? 'border-red-200 bg-red-50 text-red-700'
          : 'border-slate-200 bg-white text-slate-700',
      )}
    >
      <span className="text-xs font-medium uppercase tracking-wide text-current opacity-70">
        {label}
      </span>
      <span className="text-lg font-bold tabular-nums">{value}</span>
    </div>
  );
}

function QueueCard({
  name,
  counts,
}: {
  name: string;
  counts: QueueCounts;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col gap-3 rounded-2xl border border-white/40 bg-white/70 p-4 shadow-lg backdrop-blur-lg"
    >
      <h3 className="text-sm font-semibold text-slate-900">{name}</h3>
      <div className="grid grid-cols-3 gap-2">
        <CountCell label="Failed" value={counts.failed} danger />
        <CountCell label="Processing" value={counts.processing} />
        <CountCell label="Pending" value={counts.pending ?? 0} />
      </div>
    </motion.div>
  );
}

export function QueueHealthPanel({ data }: QueueHealthPanelProps) {
  const queues: Array<keyof typeof QUEUE_LABELS> = [
    'pipeline',
    'render',
    'publish',
  ];

  return (
    <div className="flex flex-col gap-4">
      <div
        className={cn(
          'flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-medium',
          data.broker_reachable
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
            : 'border-red-200 bg-red-50 text-red-700',
        )}
      >
        <span
          className={cn(
            'inline-block h-2.5 w-2.5 rounded-full',
            data.broker_reachable ? 'bg-emerald-500' : 'bg-red-500',
          )}
        />
        {data.broker_reachable
          ? 'Message broker reachable'
          : 'Message broker unreachable'}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {queues.map((key) => (
          <QueueCard key={key} name={QUEUE_LABELS[key]} counts={data[key]} />
        ))}
      </div>
    </div>
  );
}

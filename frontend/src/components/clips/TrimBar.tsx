import { useId } from 'react';
import { cn, formatDuration } from '../../lib/utils';

export interface TrimRange {
  start: number;
  end: number;
}

interface TrimBarProps {
  sourceDuration: number;
  value: TrimRange;
  onChange: (range: TrimRange) => void;
  /** Minimum allowed clip length in seconds. */
  minLength?: number;
  step?: number;
  className?: string;
}

/**
 * Dual-handle range slider for in/out points within [0, sourceDuration].
 * Built from two overlaid native range inputs, so it is keyboard accessible.
 */
export function TrimBar({
  sourceDuration,
  value,
  onChange,
  minLength = 1,
  step = 0.1,
  className,
}: TrimBarProps) {
  const startId = useId();
  const endId = useId();
  const max = Math.max(sourceDuration, minLength);
  const start = Math.min(Math.max(value.start, 0), max - minLength);
  const end = Math.min(Math.max(value.end, start + minLength), max);

  const pct = (n: number): number => (max > 0 ? (n / max) * 100 : 0);

  const handleStart = (next: number): void => {
    const clamped = Math.min(Math.max(next, 0), end - minLength);
    onChange({ start: Number(clamped.toFixed(2)), end });
  };

  const handleEnd = (next: number): void => {
    const clamped = Math.max(Math.min(next, max), start + minLength);
    onChange({ start, end: Number(clamped.toFixed(2)) });
  };

  return (
    <div className={cn('w-full', className)}>
      <div className="mb-2 flex items-center justify-between text-sm text-slate-600">
        <span>In {formatDuration(start)}</span>
        <span className="font-semibold text-slate-800">
          {formatDuration(end - start)}
        </span>
        <span>Out {formatDuration(end)}</span>
      </div>

      <div className="relative h-8">
        <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-slate-200" />
        <div
          className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-gradient-to-r from-brand-500 to-accent-500"
          style={{ left: `${pct(start)}%`, right: `${100 - pct(end)}%` }}
        />
        <label htmlFor={startId} className="sr-only">
          Clip start
        </label>
        <input
          id={startId}
          type="range"
          min={0}
          max={max}
          step={step}
          value={start}
          onChange={(e) => handleStart(Number(e.target.value))}
          className="pointer-events-none absolute inset-x-0 top-0 h-8 w-full appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-brand-600 [&::-webkit-slider-thumb]:bg-white [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-brand-600 [&::-moz-range-thumb]:bg-white"
        />
        <label htmlFor={endId} className="sr-only">
          Clip end
        </label>
        <input
          id={endId}
          type="range"
          min={0}
          max={max}
          step={step}
          value={end}
          onChange={(e) => handleEnd(Number(e.target.value))}
          className="pointer-events-none absolute inset-x-0 top-0 h-8 w-full appearance-none bg-transparent [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-accent-600 [&::-webkit-slider-thumb]:bg-white [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-accent-600 [&::-moz-range-thumb]:bg-white"
        />
      </div>
    </div>
  );
}

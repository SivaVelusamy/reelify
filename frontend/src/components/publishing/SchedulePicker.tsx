import { useId } from 'react';
import { cn } from '../../lib/utils';

/** Convert an ISO timestamp to a value a <input type="datetime-local"> accepts. */
function isoToLocalInput(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const pad = (value: number): string => String(value).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/** Convert a datetime-local value (local time) to an ISO string, or null. */
function localInputToIso(value: string): string | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

interface SchedulePickerProps {
  /** ISO string when scheduled, or null for "publish now". */
  value: string | null;
  onChange: (value: string | null) => void;
  className?: string;
}

export function SchedulePicker({
  value,
  onChange,
  className,
}: SchedulePickerProps) {
  const groupId = useId();
  const mode: 'now' | 'schedule' = value === null ? 'now' : 'schedule';

  const handleModeChange = (next: 'now' | 'schedule'): void => {
    if (next === 'now') {
      onChange(null);
      return;
    }
    // Default to one hour from now when switching to "schedule".
    const inOneHour = new Date(Date.now() + 60 * 60 * 1000);
    onChange(inOneHour.toISOString());
  };

  return (
    <div className={cn('flex flex-col gap-3', className)}>
      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="radio"
            name={groupId}
            checked={mode === 'now'}
            onChange={() => handleModeChange('now')}
          />
          Publish now
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="radio"
            name={groupId}
            checked={mode === 'schedule'}
            onChange={() => handleModeChange('schedule')}
          />
          Schedule for later
        </label>
      </div>

      {mode === 'schedule' && (
        <input
          type="datetime-local"
          aria-label="Scheduled date and time"
          value={value ? isoToLocalInput(value) : ''}
          onChange={(event) => onChange(localInputToIso(event.target.value))}
          className="rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
        />
      )}
    </div>
  );
}

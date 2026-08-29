import { useMemo, useState } from 'react';
import {
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from 'date-fns';
import { StatusBadge } from '../ui/StatusBadge';
import { PLATFORM_LABELS } from '../../types/publishing';
import type { CalendarEntry } from '../../types/publishing';
import { cn } from '../../lib/utils';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

interface CalendarGridProps {
  /** Any date within the month to render. */
  month: Date;
  entries: CalendarEntry[];
}

function entryLabel(entry: CalendarEntry): string {
  if (entry.platform) {
    return PLATFORM_LABELS[entry.platform];
  }
  if (entry.destination_type === 'link') {
    return 'Link';
  }
  return entry.destination_type;
}

export function CalendarGrid({ month, entries }: CalendarGridProps) {
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const days = useMemo(() => {
    const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const gridEnd = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    return eachDayOfInterval({ start: gridStart, end: gridEnd });
  }, [month]);

  const entriesByDay = useMemo(() => {
    const map = new Map<string, CalendarEntry[]>();
    for (const entry of entries) {
      const date = parseISO(entry.scheduled_at);
      if (Number.isNaN(date.getTime())) {
        continue;
      }
      const key = format(date, 'yyyy-MM-dd');
      const bucket = map.get(key) ?? [];
      bucket.push(entry);
      map.set(key, bucket);
    }
    return map;
  }, [entries]);

  const selectedEntries = selectedDay
    ? entriesByDay.get(format(selectedDay, 'yyyy-MM-dd')) ?? []
    : [];

  return (
    <div className="flex flex-col gap-4">
      <div className="overflow-x-auto">
        <div className="min-w-[640px]">
          <div className="grid grid-cols-7 border-b border-slate-200 text-xs font-semibold text-slate-500">
            {WEEKDAYS.map((weekday) => (
              <div key={weekday} className="px-2 py-2">
                {weekday}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((day) => {
              const key = format(day, 'yyyy-MM-dd');
              const dayEntries = entriesByDay.get(key) ?? [];
              const inMonth = isSameMonth(day, month);
              const isSelected = selectedDay
                ? isSameDay(day, selectedDay)
                : false;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedDay(day)}
                  className={cn(
                    'flex min-h-[92px] flex-col gap-1 border-b border-r border-slate-100 p-1.5 text-left align-top',
                    inMonth ? 'bg-white' : 'bg-slate-50 text-slate-400',
                    isSelected && 'ring-2 ring-inset ring-brand-400',
                  )}
                >
                  <span className="text-xs font-semibold">
                    {format(day, 'd')}
                  </span>
                  <span className="flex flex-col gap-1">
                    {dayEntries.slice(0, 3).map((entry) => (
                      <span
                        key={entry.publish_job_id}
                        className="truncate rounded bg-brand-100 px-1 py-0.5 text-[10px] font-medium text-brand-700"
                      >
                        {format(parseISO(entry.scheduled_at), 'HH:mm')}{' '}
                        {entryLabel(entry)}
                      </span>
                    ))}
                    {dayEntries.length > 3 && (
                      <span className="text-[10px] text-slate-500">
                        +{dayEntries.length - 3} more
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {selectedDay && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-800">
            {format(selectedDay, 'EEEE, MMMM d')}
          </h3>
          {selectedEntries.length === 0 ? (
            <p className="text-sm text-slate-500">Nothing scheduled this day.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {selectedEntries.map((entry) => (
                <li
                  key={entry.publish_job_id}
                  className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">
                      {entry.clip_title}
                    </p>
                    <p className="text-xs text-slate-500">
                      {format(parseISO(entry.scheduled_at), 'HH:mm')} ·{' '}
                      {entryLabel(entry)}
                    </p>
                  </div>
                  <StatusBadge status={entry.status} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

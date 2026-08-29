import { useMemo, useState } from 'react';
import {
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PageWrapper } from '../components/layout/PageWrapper';
import { EmptyState } from '../components/ui/EmptyState';
import { GradientButton } from '../components/ui/GradientButton';
import { Spinner } from '../components/ui/Spinner';
import { CalendarGrid } from '../components/publishing/CalendarGrid';
import { usePublishCalendar } from '../hooks/usePublishing';

export default function PublishCalendarPage() {
  const [month, setMonth] = useState<Date>(() => startOfMonth(new Date()));

  const range = useMemo(() => {
    const from = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const to = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    return { from: from.toISOString(), to: to.toISOString() };
  }, [month]);

  const { data, isLoading, isError, refetch } = usePublishCalendar(range);
  const entries = data ?? [];

  return (
    <PageWrapper title="Publishing calendar">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMonth((current) => subMonths(current, 1))}
            aria-label="Previous month"
            className="rounded-full border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50"
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => setMonth((current) => addMonths(current, 1))}
            aria-label="Next month"
            className="rounded-full border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50"
          >
            <ChevronRight size={16} />
          </button>
          <h2 className="ml-2 text-lg font-semibold text-slate-900">
            {format(month, 'MMMM yyyy')}
          </h2>
        </div>
        <button
          type="button"
          onClick={() => setMonth(startOfMonth(new Date()))}
          className="rounded-full border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
        >
          Today
        </button>
      </div>

      {isLoading && (
        <div className="flex justify-center py-20">
          <Spinner size={32} />
        </div>
      )}

      {isError && !isLoading && (
        <EmptyState
          title="Could not load the calendar"
          description="Something went wrong while fetching scheduled posts."
          action={
            <GradientButton type="button" onClick={() => void refetch()}>
              Try again
            </GradientButton>
          }
        />
      )}

      {!isLoading && !isError && (
        <CalendarGrid month={month} entries={entries} />
      )}
    </PageWrapper>
  );
}

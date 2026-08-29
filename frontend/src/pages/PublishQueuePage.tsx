import { useState } from 'react';
import { Send } from 'lucide-react';
import { PageWrapper } from '../components/layout/PageWrapper';
import { AnimatedList } from '../components/ui/AnimatedList';
import { EmptyState } from '../components/ui/EmptyState';
import { GradientButton } from '../components/ui/GradientButton';
import { Spinner } from '../components/ui/Spinner';
import { PublishJobRow } from '../components/publishing/PublishJobRow';
import { usePublishJobs } from '../hooks/usePublishing';
import { PUBLISH_JOB_STATUSES } from '../types/publishing';
import type { PublishJobStatus } from '../types/publishing';
import { cn } from '../lib/utils';

type StatusFilter = 'all' | PublishJobStatus;

const FILTERS: StatusFilter[] = ['all', ...PUBLISH_JOB_STATUSES];

export default function PublishQueuePage() {
  const [filter, setFilter] = useState<StatusFilter>('all');
  const { data, isLoading, isError, refetch } = usePublishJobs(
    filter === 'all' ? {} : { status: filter },
  );

  const jobs = data ?? [];

  return (
    <PageWrapper title="Publish queue">
      <div className="mb-6 flex flex-wrap gap-2">
        {FILTERS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setFilter(option)}
            aria-pressed={filter === option}
            className={cn(
              'rounded-full border px-4 py-1.5 text-sm font-semibold capitalize transition-colors',
              filter === option
                ? 'border-brand-500 bg-brand-50 text-brand-700'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50',
            )}
          >
            {option}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="flex justify-center py-20">
          <Spinner size={32} />
        </div>
      )}

      {isError && !isLoading && (
        <EmptyState
          title="Could not load publish jobs"
          description="Something went wrong while fetching the queue."
          action={
            <GradientButton type="button" onClick={() => void refetch()}>
              Try again
            </GradientButton>
          }
        />
      )}

      {!isLoading && !isError && jobs.length === 0 && (
        <EmptyState
          icon={Send}
          title="No publish jobs"
          description={
            filter === 'all'
              ? 'Publish or schedule a clip to see it here.'
              : `No ${filter} jobs right now.`
          }
        />
      )}

      {!isLoading && !isError && jobs.length > 0 && (
        <AnimatedList>
          {jobs.map((job) => (
            <PublishJobRow key={job.id} job={job} />
          ))}
        </AnimatedList>
      )}
    </PageWrapper>
  );
}

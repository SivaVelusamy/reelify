import { RefreshCw } from 'lucide-react';
import { PageWrapper } from '../components/layout/PageWrapper';
import { QueueHealthPanel } from '../components/admin/QueueHealthPanel';
import { GradientButton } from '../components/ui/GradientButton';
import { Spinner } from '../components/ui/Spinner';
import { EmptyState } from '../components/ui/EmptyState';
import { useAdminJobs } from '../hooks/useAdmin';

export default function AdminJobsPage() {
  const { data, isLoading, isError, isFetching, refetch } = useAdminJobs();

  return (
    <PageWrapper title="Job queue health">
      <div className="mb-4 flex items-center gap-2 text-xs text-slate-500">
        <RefreshCw
          size={14}
          className={isFetching ? 'animate-spin' : undefined}
        />
        Auto-refreshes every 15 seconds.
      </div>

      {isLoading && (
        <div className="flex justify-center py-20">
          <Spinner size={32} />
        </div>
      )}

      {isError && !isLoading && (
        <EmptyState
          title="Could not load queue health"
          description="Something went wrong while fetching worker status."
          action={
            <GradientButton type="button" onClick={() => void refetch()}>
              Try again
            </GradientButton>
          }
        />
      )}

      {!isLoading && !isError && data && <QueueHealthPanel data={data} />}
    </PageWrapper>
  );
}

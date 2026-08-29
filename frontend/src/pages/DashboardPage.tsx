import { Clapperboard, FolderKanban, HardDrive, Timer } from 'lucide-react';
import { PageWrapper } from '../components/layout/PageWrapper';
import { GlassCard } from '../components/ui/GlassCard';
import { GradientButton } from '../components/ui/GradientButton';
import { Spinner } from '../components/ui/Spinner';
import { EmptyState } from '../components/ui/EmptyState';
import { UsageStatCard } from '../components/dashboard/UsageStatCard';
import { LimitMeter } from '../components/dashboard/LimitMeter';
import { ActivityFeed } from '../components/dashboard/ActivityFeed';
import { QuickUploadButton } from '../components/dashboard/QuickUploadButton';
import { useDashboardSummary } from '../hooks/useDashboard';
import { useAuth } from '../hooks/useAuth';
import { formatBytes, formatDate } from '../lib/utils';

function firstName(fullName: string | null): string {
  if (!fullName) {
    return 'there';
  }
  const [first] = fullName.trim().split(/\s+/);
  return first || 'there';
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { data: summary, isLoading, isError, refetch } = useDashboardSummary();

  return (
    <PageWrapper>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">
            Welcome back, {firstName(user?.full_name ?? null)}
          </h1>
          <p className="text-sm text-slate-500">
            Here is how your workspace is doing.
          </p>
        </div>
        <QuickUploadButton />
      </div>

      {isLoading && (
        <div className="flex justify-center py-20">
          <Spinner size={32} />
        </div>
      )}

      {isError && !isLoading && (
        <EmptyState
          title="Could not load your dashboard"
          description="Something went wrong while fetching your usage summary."
          action={
            <GradientButton type="button" onClick={() => void refetch()}>
              Try again
            </GradientButton>
          }
        />
      )}

      {!isLoading && !isError && summary && (
        <div className="flex flex-col gap-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <UsageStatCard
              label="Minutes processed"
              value={`${Math.round(summary.minutes_processed).toLocaleString()} min`}
              subLine={`Since ${formatDate(summary.period_start)}`}
              icon={Timer}
            />
            <UsageStatCard
              label="Clips generated"
              value={summary.clips_generated.toLocaleString()}
              subLine="This billing period"
              icon={Clapperboard}
            />
            <UsageStatCard
              label="Storage used"
              value={formatBytes(summary.storage_used_bytes)}
              subLine="Across all rendered clips"
              icon={HardDrive}
            />
            <UsageStatCard
              label="Projects"
              value={summary.projects_count.toLocaleString()}
              subLine={
                summary.videos_processing > 0
                  ? `${summary.videos_processing} video(s) processing`
                  : 'No videos processing'
              }
              icon={FolderKanban}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-1">
              <LimitMeter
                minutesUsed={summary.minutes_processed}
                minutesLimit={summary.minutes_limit}
                usedPct={summary.minutes_used_pct}
              />
              <GlassCard className="mt-6 flex flex-col gap-1">
                <p className="text-sm font-medium text-slate-500">Current plan</p>
                <p className="text-lg font-semibold capitalize text-slate-900">
                  {summary.plan}
                </p>
                <p className="text-xs text-slate-500">
                  Renews {formatDate(summary.period_end)}
                </p>
              </GlassCard>
            </div>

            <div className="lg:col-span-2">
              <ActivityFeed />
            </div>
          </div>
        </div>
      )}
    </PageWrapper>
  );
}

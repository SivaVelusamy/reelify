import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Clapperboard,
  Clock,
  Send,
  Users,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import { PageWrapper } from '../components/layout/PageWrapper';
import { GlassCard } from '../components/ui/GlassCard';
import { GradientButton } from '../components/ui/GradientButton';
import { Spinner } from '../components/ui/Spinner';
import { EmptyState } from '../components/ui/EmptyState';
import { StatTile } from '../components/admin/StatTile';
import { useAdminStats } from '../hooks/useAdmin';

function formatUsd(cents: number): string {
  return (cents / 100).toLocaleString(undefined, {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  });
}

export default function AdminDashboardPage() {
  const { data, isLoading, isError, refetch } = useAdminStats();

  return (
    <PageWrapper title="Admin overview">
      {isLoading && (
        <div className="flex justify-center py-20">
          <Spinner size={32} />
        </div>
      )}

      {isError && !isLoading && (
        <EmptyState
          title="Could not load platform stats"
          description="Something went wrong while fetching the metrics."
          action={
            <GradientButton type="button" onClick={() => void refetch()}>
              Try again
            </GradientButton>
          }
        />
      )}

      {!isLoading && !isError && data && (
        <div className="flex flex-col gap-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatTile
              label="Total users"
              value={data.users_total.toLocaleString()}
              icon={Users}
            />
            <StatTile
              label="Active users"
              value={data.users_active.toLocaleString()}
              icon={UserCheck}
            />
            <StatTile
              label="New (30 days)"
              value={data.users_new_30d.toLocaleString()}
              delta="last 30 days"
              icon={UserPlus}
            />
            <StatTile
              label="Minutes processed (30d)"
              value={data.minutes_processed_30d.toLocaleString()}
              icon={Clock}
            />
            <StatTile
              label="Clips generated"
              value={data.clips_generated_total.toLocaleString()}
              icon={Clapperboard}
            />
            <StatTile
              label="Publish jobs"
              value={data.publish_jobs_total.toLocaleString()}
              icon={Send}
            />
          </div>

          <GlassCard className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-500">
              Estimated monthly revenue
            </span>
            <span className="text-3xl font-bold text-slate-900">
              {formatUsd(data.revenue_estimate_cents)}
            </span>
            <span className="text-xs text-slate-400">
              Derived from active paid subscriptions.
            </span>
          </GlassCard>

          <GlassCard>
            <h2 className="mb-4 text-sm font-semibold text-slate-900">
              User breakdown
            </h2>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={[
                    { name: 'Total', value: data.users_total },
                    { name: 'Active', value: data.users_active },
                    { name: 'New 30d', value: data.users_new_30d },
                  ]}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="value" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </GlassCard>
        </div>
      )}
    </PageWrapper>
  );
}

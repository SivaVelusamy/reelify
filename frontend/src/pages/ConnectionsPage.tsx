import { useSearchParams } from 'react-router-dom';
import { PageWrapper } from '../components/layout/PageWrapper';
import { GlassCard } from '../components/ui/GlassCard';
import { Spinner } from '../components/ui/Spinner';
import { EmptyState } from '../components/ui/EmptyState';
import { ConnectAccountButton } from '../components/publishing/ConnectAccountButton';
import { AccountStatusRow } from '../components/publishing/AccountStatusRow';
import { useSocialAccounts } from '../hooks/usePublishing';
import {
  CONNECTABLE_PLATFORMS,
  PLATFORM_LABELS,
} from '../types/publishing';

export default function ConnectionsPage() {
  const [params] = useSearchParams();
  const justConnected = params.get('connected');
  const connectError = params.get('connect_error');
  const simulated = params.get('simulated') === '1';
  const { data: accounts, isLoading, isError, refetch } = useSocialAccounts();

  const label = (p: string) =>
    PLATFORM_LABELS[p as keyof typeof PLATFORM_LABELS] ?? p;

  return (
    <PageWrapper>
      <div className="mx-auto max-w-3xl space-y-6">
        <header>
          <h1 className="text-2xl font-semibold text-slate-900">Connections</h1>
          <p className="mt-1 text-sm text-slate-500">
            Connect the destinations Reelify can publish your clips to. TikTok,
            Instagram and YouTube use a simulated connection until real OAuth
            credentials are configured — publishing to them is stubbed.
          </p>
        </header>

        {justConnected && (
          <div
            role="status"
            className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
          >
            {label(justConnected)} connected
            {simulated ? ' (simulated).' : '.'}
          </div>
        )}

        {connectError && (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            Could not connect {label(connectError)}. Please try again.
          </div>
        )}

        <GlassCard>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Add a destination
          </h2>
          <div className="flex flex-wrap gap-3">
            {CONNECTABLE_PLATFORMS.map((platform) => (
              <ConnectAccountButton key={platform} platform={platform} />
            ))}
          </div>
        </GlassCard>

        <GlassCard>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Connected accounts
          </h2>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Spinner size={28} />
            </div>
          ) : isError ? (
            <EmptyState
              title="Could not load connections"
              description="Something went wrong fetching your connected accounts."
              action={
                <button
                  type="button"
                  className="text-sm font-medium text-brand-600 hover:text-brand-700"
                  onClick={() => void refetch()}
                >
                  Retry
                </button>
              }
            />
          ) : !accounts || accounts.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">
              No accounts connected yet.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {accounts.map((account) => (
                <li key={account.id} className="py-3">
                  <AccountStatusRow account={account} />
                </li>
              ))}
            </ul>
          )}
        </GlassCard>
      </div>
    </PageWrapper>
  );
}

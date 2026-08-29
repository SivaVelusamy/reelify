import { useLocation, useParams } from 'react-router-dom';
import { GlassCard } from '../components/ui/GlassCard';
import { PageWrapper } from '../components/layout/PageWrapper';

interface PlaceholderProps {
  /** Human-readable route/page name, e.g. "DashboardPage". */
  name: string;
}

/**
 * Foundation-phase stand-in for every route. Phase 2 module agents replace
 * each usage in App.tsx with the real page component.
 */
export default function Placeholder({ name }: PlaceholderProps) {
  const location = useLocation();
  const params = useParams();
  const paramEntries = Object.entries(params);

  return (
    <PageWrapper title={name}>
      <GlassCard className="max-w-xl">
        <p className="text-sm text-slate-600">
          Placeholder page. This route is scaffolded and wired, awaiting its
          Phase 2 implementation.
        </p>
        <dl className="mt-4 space-y-1 text-sm">
          <div className="flex gap-2">
            <dt className="font-medium text-slate-500">Path:</dt>
            <dd className="font-mono text-slate-800">{location.pathname}</dd>
          </div>
          {paramEntries.length > 0 && (
            <div className="flex gap-2">
              <dt className="font-medium text-slate-500">Params:</dt>
              <dd className="font-mono text-slate-800">
                {paramEntries.map(([key, value]) => `${key}=${value ?? ''}`).join(', ')}
              </dd>
            </div>
          )}
        </dl>
      </GlassCard>
    </PageWrapper>
  );
}

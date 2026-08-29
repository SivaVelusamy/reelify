import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CreditCard } from 'lucide-react';
import { PageWrapper } from '../components/layout/PageWrapper';
import { GlassCard } from '../components/ui/GlassCard';
import { GradientButton } from '../components/ui/GradientButton';
import { Spinner } from '../components/ui/Spinner';
import { EmptyState } from '../components/ui/EmptyState';
import { PlanCard } from '../components/billing/PlanCard';
import { UsageMeter } from '../components/billing/UsageMeter';
import { useBillingOverview, useOpenPortal } from '../hooks/useBilling';
import { formatDate } from '../lib/utils';
import type { Plan, PlanMarketing } from '../types/billing';

const PLAN_MARKETING: PlanMarketing[] = [
  {
    plan: 'free',
    name: 'Free',
    price: '$0',
    priceSuffix: '/mo',
    tagline: 'Try Reelify with a light monthly allowance.',
    features: [
      '30 minutes of video processing / month',
      'Auto-generated clip candidates',
      'Basic captions',
      '1 GB storage',
    ],
  },
  {
    plan: 'starter',
    name: 'Starter',
    price: '$29',
    priceSuffix: '/mo',
    tagline: 'For creators publishing every week.',
    features: [
      '300 minutes of video processing / month',
      'Everything in Free',
      'Brand kits & caption presets',
      'Scheduled publishing',
      '50 GB storage',
    ],
  },
  {
    plan: 'pro',
    name: 'Pro',
    price: '$99',
    priceSuffix: '/mo',
    tagline: 'For teams and high-volume channels.',
    features: [
      '1,200 minutes of video processing / month',
      'Everything in Starter',
      'Priority rendering queue',
      'Team seats & advanced analytics',
      '500 GB storage',
    ],
  },
];

type CheckoutOutcome = 'success' | 'cancelled';

function isCheckoutOutcome(value: string | null): value is CheckoutOutcome {
  return value === 'success' || value === 'cancelled';
}

export default function BillingPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { data, isLoading, isError, refetch } = useBillingOverview();
  const portal = useOpenPortal();

  const [banner, setBanner] = useState<CheckoutOutcome | null>(null);
  const [portalError, setPortalError] = useState<string | null>(null);

  const checkoutParam = searchParams.get('checkout');

  useEffect(() => {
    if (!isCheckoutOutcome(checkoutParam)) {
      return;
    }
    setBanner(checkoutParam);
    void refetch();
    const next = new URLSearchParams(searchParams);
    next.delete('checkout');
    setSearchParams(next, { replace: true });
    // searchParams identity changes each render; guard on the raw value only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkoutParam]);

  const handleManage = async (): Promise<void> => {
    setPortalError(null);
    try {
      await portal.mutateAsync();
    } catch {
      setPortalError('Could not open the billing portal. Please try again.');
    }
  };

  const subscription = data?.subscription ?? null;
  const activePlan: Plan = subscription?.plan ?? 'free';

  return (
    <PageWrapper title="Billing">
      <div className="mx-auto max-w-5xl space-y-6">
        {banner && (
          <div
            role="status"
            className={
              banner === 'success'
                ? 'rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800'
                : 'rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800'
            }
          >
            {banner === 'success'
              ? 'Payment received. Your plan will update in a moment.'
              : 'Checkout was cancelled. No changes were made to your plan.'}
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-16">
            <Spinner size={32} />
          </div>
        ) : isError || !data ? (
          <EmptyState
            title="Could not load billing"
            description="Something went wrong fetching your subscription and usage."
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
        ) : (
          <>
            <GlassCard>
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
                    Current subscription
                  </h2>
                  <p className="mt-2 text-2xl font-bold capitalize text-slate-900">
                    {activePlan} plan
                  </p>
                  {subscription ? (
                    <p className="mt-1 text-sm text-slate-500">
                      Status:{' '}
                      <span className="font-medium text-slate-700">
                        {subscription.status}
                      </span>
                      {subscription.current_period_end && (
                        <>
                          {' · '}
                          {subscription.cancel_at_period_end
                            ? 'Ends'
                            : 'Renews'}{' '}
                          {formatDate(subscription.current_period_end)}
                        </>
                      )}
                    </p>
                  ) : (
                    <p className="mt-1 text-sm text-slate-500">
                      You are on the free plan. Upgrade any time.
                    </p>
                  )}
                </div>

                {subscription && (
                  <div className="flex flex-col items-end gap-2">
                    <GradientButton
                      type="button"
                      onClick={() => void handleManage()}
                      isLoading={portal.isPending}
                    >
                      <span className="inline-flex items-center gap-2">
                        <CreditCard size={16} aria-hidden />
                        Manage subscription
                      </span>
                    </GradientButton>
                    {portalError && (
                      <p role="alert" className="text-sm text-red-600">
                        {portalError}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </GlassCard>

            <UsageMeter usage={data.usage} />

            <section>
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">
                Plans
              </h2>
              <div className="grid gap-6 md:grid-cols-3">
                {PLAN_MARKETING.map((marketing) => (
                  <PlanCard
                    key={marketing.plan}
                    marketing={marketing}
                    isCurrent={marketing.plan === activePlan}
                    minutesLimit={
                      marketing.plan === activePlan
                        ? data.usage.minutes_limit
                        : null
                    }
                  />
                ))}
              </div>
            </section>
          </>
        )}
      </div>
    </PageWrapper>
  );
}

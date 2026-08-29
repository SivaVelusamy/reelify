import { Check } from 'lucide-react';
import { GlassCard } from '../ui/GlassCard';
import { GradientButton } from '../ui/GradientButton';
import { useStartCheckout } from '../../hooks/useBilling';
import type { PlanMarketing } from '../../types/billing';

interface PlanCardProps {
  marketing: PlanMarketing;
  /** True when this is the plan the user is currently subscribed to. */
  isCurrent: boolean;
  /**
   * Live minutes allowance from the API, when known. Overrides the value
   * baked into the marketing feature list is left to the caller; this is
   * shown as a small caption under the price.
   */
  minutesLimit?: number | null;
}

export function PlanCard({ marketing, isCurrent, minutesLimit }: PlanCardProps) {
  const { plan, name, price, priceSuffix, tagline, features } = marketing;
  const checkout = useStartCheckout();
  const isPaid = plan !== 'free';

  const handleUpgrade = (): void => {
    if (plan === 'free') {
      return;
    }
    checkout.mutate(plan);
  };

  return (
    <GlassCard className={isCurrent ? 'ring-2 ring-brand-500' : ''}>
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">{name}</h3>
          {isCurrent && (
            <span className="rounded-full bg-brand-100 px-3 py-1 text-xs font-semibold text-brand-700">
              Current plan
            </span>
          )}
        </div>

        <p className="mt-1 text-sm text-slate-500">{tagline}</p>

        <div className="mt-4 flex items-baseline gap-1">
          <span className="text-3xl font-bold text-slate-900">{price}</span>
          <span className="text-sm text-slate-500">{priceSuffix}</span>
        </div>

        {typeof minutesLimit === 'number' && (
          <p className="mt-1 text-xs text-slate-500">
            {minutesLimit} minutes / month included
          </p>
        )}

        <ul className="mt-4 flex-1 space-y-2">
          {features.map((feature) => (
            <li
              key={feature}
              className="flex items-start gap-2 text-sm text-slate-700"
            >
              <Check
                size={16}
                className="mt-0.5 shrink-0 text-brand-600"
                aria-hidden
              />
              <span>{feature}</span>
            </li>
          ))}
        </ul>

        <div className="mt-6">
          {isCurrent ? (
            <p className="text-center text-sm font-medium text-slate-400">
              You are on this plan
            </p>
          ) : isPaid ? (
            <GradientButton
              type="button"
              className="w-full"
              onClick={handleUpgrade}
              isLoading={checkout.isPending}
            >
              Upgrade to {name}
            </GradientButton>
          ) : (
            <p className="text-center text-sm text-slate-400">
              Free forever
            </p>
          )}

          {checkout.isError && (
            <p role="alert" className="mt-2 text-center text-sm text-red-600">
              Could not start checkout. Please try again.
            </p>
          )}
        </div>
      </div>
    </GlassCard>
  );
}

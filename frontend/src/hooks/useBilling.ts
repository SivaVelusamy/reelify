// Module 7 (Billing / Stripe) — react-query v5 hooks.

import {
  useMutation,
  useQuery,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import {
  createCheckoutSession,
  createPortalSession,
  getOverview,
} from '../services/billingService';
import type { BillingOverview, PaidPlan } from '../types/billing';

export const billingKeys = {
  overview: ['billing', 'overview'] as const,
};

/** Current subscription + usage for the signed-in user. */
export function useBillingOverview(): UseQueryResult<BillingOverview, Error> {
  return useQuery({
    queryKey: billingKeys.overview,
    queryFn: getOverview,
  });
}

/**
 * Starts a Stripe Checkout for a paid plan. On success the browser is
 * redirected to the hosted Checkout page.
 */
export function useStartCheckout(): UseMutationResult<string, Error, PaidPlan> {
  return useMutation({
    mutationFn: (plan: PaidPlan) => createCheckoutSession(plan),
    onSuccess: (url) => {
      window.location.assign(url);
    },
  });
}

/**
 * Opens the Stripe Customer Portal. On success the browser is redirected
 * to the hosted portal page.
 */
export function useOpenPortal(): UseMutationResult<string, Error, void> {
  return useMutation({
    mutationFn: () => createPortalSession(),
    onSuccess: (url) => {
      window.location.assign(url);
    },
  });
}

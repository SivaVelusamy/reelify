// Module 7 (Billing / Stripe) — typed API wrappers over /api/v1/billing.

import api from './api';
import type {
  BillingOverview,
  PaidPlan,
  StripeRedirect,
} from '../types/billing';

/**
 * POST /billing/checkout-session — start a Stripe Checkout for a paid plan.
 * Returns the hosted Checkout URL the browser should navigate to.
 */
export async function createCheckoutSession(plan: PaidPlan): Promise<string> {
  const { data } = await api.post<StripeRedirect>('/billing/checkout-session', {
    plan,
  });
  return data.url;
}

/**
 * POST /billing/portal-session — open the Stripe Customer Portal.
 * Returns the hosted portal URL the browser should navigate to.
 */
export async function createPortalSession(): Promise<string> {
  const { data } = await api.post<StripeRedirect>('/billing/portal-session');
  return data.url;
}

/** GET /billing/subscription — current subscription + period usage. */
export async function getOverview(): Promise<BillingOverview> {
  const { data } = await api.get<BillingOverview>('/billing/subscription');
  return data;
}

// Module 7 (Billing / Stripe) — request/response shapes for the billing UI.
// src/types/index.ts is not edited; billing-specific contracts live here.

import type { SubscriptionStatus } from './index';

export type { SubscriptionStatus };

/** Every plan a user can be on. */
export type Plan = 'free' | 'starter' | 'pro';

/** Plans that can be purchased through Stripe Checkout. */
export type PaidPlan = Exclude<Plan, 'free'>;

/**
 * Current subscription as returned by GET /billing/subscription.
 * `null` at the API level means the user is on the implicit free plan.
 */
export interface Subscription {
  plan: Plan;
  status: SubscriptionStatus;
  /** ISO timestamp of the end of the current billing period. */
  current_period_end: string | null;
  /** True when the subscription is set to end at `current_period_end`. */
  cancel_at_period_end?: boolean;
}

/** Usage for the active billing period, from GET /billing/subscription. */
export interface Usage {
  minutes_processed: number;
  clips_generated: number;
  storage_bytes: number;
  /** Minutes allowance for the current plan. */
  minutes_limit: number;
  /** True when `minutes_processed` has passed `minutes_limit`. */
  over_limit: boolean;
}

/** Full payload of GET /billing/subscription. */
export interface BillingOverview {
  subscription: Subscription | null;
  usage: Usage;
}

/** POST /billing/checkout-session and /billing/portal-session both return this. */
export interface StripeRedirect {
  url: string;
}

/** Static marketing copy for a plan, merged with live numbers from the API. */
export interface PlanMarketing {
  plan: Plan;
  name: string;
  /** Display price, e.g. "$29" — pricing detail such as "/mo" is rendered separately. */
  price: string;
  priceSuffix: string;
  tagline: string;
  features: string[];
}

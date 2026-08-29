// Module 9 (Admin Panel) — request/response shapes for the /api/v1/admin/*
// endpoints. Shared contracts live in ./index.ts and are not modified here.

import type { UserPlan } from './index';

/** Selectable plan values in the admin UI. */
export const ADMIN_USER_PLANS: readonly UserPlan[] = [
  'free',
  'starter',
  'pro',
  'enterprise',
] as const;

/** Account status filter values. */
export type AdminUserStatus = 'active' | 'inactive';

/* -------------------------------------------------------------------------- */
/* Users                                                                      */
/* -------------------------------------------------------------------------- */

/** One row of GET /admin/users. */
export interface AdminUserRow {
  id: number;
  email: string;
  full_name: string | null;
  is_active: boolean;
  is_admin: boolean;
  plan: string;
  created_at: string;
  minutes_this_month: number;
  clips_count: number;
}

/** GET /admin/users/{id} — a row plus expanded usage detail. */
export interface AdminUserDetail extends AdminUserRow {
  subscription_status: string | null;
  projects_count: number;
  videos_count: number;
}

/** PUT /admin/users/{id} — every field optional. */
export interface AdminUserUpdate {
  is_active?: boolean;
  is_admin?: boolean;
  plan?: string;
}

/** GET /admin/users — paginated envelope. */
export interface PaginatedUsers {
  items: AdminUserRow[];
  total: number;
  page: number;
  per_page: number;
}

/** Query filters accepted by GET /admin/users. */
export interface AdminUserFilters {
  q?: string;
  plan?: string;
  status?: AdminUserStatus;
  page?: number;
  per_page?: number;
}

/* -------------------------------------------------------------------------- */
/* Platform stats                                                             */
/* -------------------------------------------------------------------------- */

/** GET /admin/stats. */
export interface PlatformStats {
  users_total: number;
  users_active: number;
  users_new_30d: number;
  minutes_processed_30d: number;
  clips_generated_total: number;
  publish_jobs_total: number;
  revenue_estimate_cents: number;
}

/* -------------------------------------------------------------------------- */
/* Job queue health                                                           */
/* -------------------------------------------------------------------------- */

/** Counts for a single processing queue. */
export interface QueueCounts {
  failed: number;
  processing: number;
  pending?: number;
}

/** GET /admin/jobs. */
export interface JobQueueHealth {
  pipeline: QueueCounts;
  render: QueueCounts;
  publish: QueueCounts;
  broker_reachable: boolean;
}

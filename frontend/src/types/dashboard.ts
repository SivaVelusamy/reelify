// TypeScript contracts for the Dashboard module (prefix: /api/v1).
// These mirror the Module 6 backend responses and are intentionally kept
// separate from src/types/index.ts.

/** Activity event kinds emitted by the backend `type` field. */
export type KnownActivityType =
  | 'video_uploaded'
  | 'video_ready'
  | 'video_failed'
  | 'clip_generated'
  | 'publish_published'
  | 'publish_failed'
  | 'project_created';

/**
 * The backend may add new activity kinds over time, so we stay liberal:
 * any string is accepted and the UI falls back to a generic presentation.
 * (`KnownActivityType` still drives editor autocomplete for the icon map.)
 */
export type ActivityType = KnownActivityType | (string & NonNullable<unknown>);

/** A single row in the activity feed. Backend ids look like `video-12-ready`. */
export interface ActivityItem {
  id: string;
  type: ActivityType;
  title: string;
  timestamp: string;
  meta: Record<string, unknown> | null;
}

/** GET /dashboard/activity */
export interface PaginatedActivity {
  items: ActivityItem[];
  total: number;
  page: number;
  per_page: number;
}

/** GET /dashboard/summary */
export interface DashboardSummary {
  period_start: string;
  period_end: string;
  minutes_processed: number;
  clips_generated: number;
  storage_used_bytes: number;
  plan: string;
  /** `null` means the plan has no monthly minutes cap. */
  minutes_limit: number | null;
  minutes_used_pct: number;
  projects_count: number;
  videos_processing: number;
}

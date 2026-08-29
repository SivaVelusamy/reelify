// Module 8 (Publishing / Distribution) — request/response shapes not covered by
// src/types/index.ts. index.ts is not edited; module-local types live here.

import type {
  PublishDestinationType,
  PublishJob as BasePublishJob,
  PublishJobStatus,
  ShareLink,
  SocialAccount,
  SocialAccountStatus,
  SocialPlatform,
} from './index';

/* -------------------------------------------------------------------------- */
/* Re-exports + aliases                                                        */
/* -------------------------------------------------------------------------- */

export type { ShareLink, SocialAccount, SocialAccountStatus, PublishJobStatus };

/** Social / distribution platform. */
export type Platform = SocialPlatform;

/** Where a clip gets published. */
export type DestinationType = PublishDestinationType;

/** Platforms backed by a real OAuth social account. */
export const SOCIAL_PLATFORMS: readonly Platform[] = [
  'tiktok',
  'instagram',
  'youtube',
] as const;

/** Every platform we can connect (social + chat). */
export const CONNECTABLE_PLATFORMS: readonly Platform[] = [
  'tiktok',
  'instagram',
  'youtube',
  'slack',
  'teams',
] as const;

/** All publish-job statuses, in lifecycle order. */
export const PUBLISH_JOB_STATUSES: readonly PublishJobStatus[] = [
  'draft',
  'scheduled',
  'publishing',
  'published',
  'failed',
] as const;

export const PLATFORM_LABELS: Record<Platform, string> = {
  tiktok: 'TikTok',
  instagram: 'Instagram',
  youtube: 'YouTube',
  slack: 'Slack',
  teams: 'Microsoft Teams',
};

/* -------------------------------------------------------------------------- */
/* Publish jobs                                                                */
/* -------------------------------------------------------------------------- */

/**
 * A publish job as returned by the list / calendar endpoints. The backend
 * denormalises the clip title and resolved platform onto the row for display.
 */
export interface PublishJob extends BasePublishJob {
  clip_title?: string | null;
  platform?: Platform | null;
}

/** GET /publish-jobs query filters. */
export interface PublishJobFilters {
  status?: PublishJobStatus;
  from?: string;
  to?: string;
}

/** PUT /publish-jobs/{id} — reschedule / edit a scheduled job. */
export interface UpdatePublishJobInput {
  scheduled_at?: string | null;
  caption_text?: string | null;
}

/* -------------------------------------------------------------------------- */
/* Publish action (POST /clips/{id}/publish)                                   */
/* -------------------------------------------------------------------------- */

interface PublishInputBase {
  caption_text: string;
  scheduled_at?: string | null;
}

export interface SocialPublishInput extends PublishInputBase {
  destination_type: 'social';
  social_account_id: number;
}

export interface WebhookPublishInput extends PublishInputBase {
  destination_type: 'slack' | 'teams';
  slack_webhook_url: string;
}

export interface LinkPublishInput extends PublishInputBase {
  destination_type: 'link';
}

/** Discriminated union accepted by POST /clips/{id}/publish. */
export type PublishInput =
  | SocialPublishInput
  | WebhookPublishInput
  | LinkPublishInput;

/** Draft state held by <DestinationPicker> before it is narrowed to PublishInput. */
export interface DestinationDraft {
  destination_type: DestinationType;
  social_account_id: number | null;
  webhook_url: string;
}

export const EMPTY_DESTINATION_DRAFT: DestinationDraft = {
  destination_type: 'social',
  social_account_id: null,
  webhook_url: '',
};

/* -------------------------------------------------------------------------- */
/* Connect flow                                                                */
/* -------------------------------------------------------------------------- */

/** POST /social-accounts/connect/{platform}. */
export interface ConnectAccountResponse {
  auth_url: string;
  state: string;
}

/* -------------------------------------------------------------------------- */
/* Calendar                                                                    */
/* -------------------------------------------------------------------------- */

/** GET /publish/calendar?from=&to= — one scheduled entry. */
export interface CalendarEntry {
  publish_job_id: number;
  clip_id: number;
  clip_title: string;
  destination_type: DestinationType;
  platform: Platform | null;
  scheduled_at: string;
  status: PublishJobStatus;
  caption_text: string | null;
}

/** Inclusive ISO date range for calendar / job queries. */
export interface DateRange {
  from: string;
  to: string;
}

/* -------------------------------------------------------------------------- */
/* Share links                                                                 */
/* -------------------------------------------------------------------------- */

/** POST /clips/{id}/share-link. */
export interface ShareLinkResponse {
  url: string;
  slug: string;
  is_active: boolean;
  expires_at: string | null;
  view_count: number;
}

/* -------------------------------------------------------------------------- */
/* Public clip (GET /s/{slug}) — unauthenticated                               */
/* -------------------------------------------------------------------------- */

export interface PublicClip {
  title: string;
  video_url: string;
  duration: number;
}

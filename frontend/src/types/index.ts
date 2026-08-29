// Shared TypeScript interfaces mirroring the backend models the frontend touches.
// Every enum is a string-literal union.

/* -------------------------------------------------------------------------- */
/* Auth                                                                        */
/* -------------------------------------------------------------------------- */

export type UserPlan = 'free' | 'starter' | 'pro' | 'enterprise';

export interface User {
  id: number;
  email: string;
  full_name: string | null;
  is_admin: boolean;
  plan: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

/* -------------------------------------------------------------------------- */
/* Projects / Uploads                                                          */
/* -------------------------------------------------------------------------- */

export interface Project {
  id: number;
  user_id: number;
  title: string;
  description: string | null;
  campaign: string | null;
  created_at: string;
  updated_at: string;
}

export type SourceVideoSourceType = 'upload' | 'youtube_url';

export type SourceVideoStatus =
  | 'queued'
  | 'transcribing'
  | 'analyzing'
  | 'clipping'
  | 'ready'
  | 'failed';

export interface SourceVideo {
  id: number;
  project_id: number;
  user_id: number;
  source_type: SourceVideoSourceType;
  original_url: string | null;
  storage_key: string | null;
  filename: string | null;
  duration_seconds: number | null;
  language: string | null;
  status: SourceVideoStatus;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
  speaker: string | null;
}

export interface Transcript {
  id: number;
  source_video_id: number;
  language: string | null;
  full_text: string;
  segments: TranscriptSegment[];
  created_at: string;
}

export type BatchUploadStatus =
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed';

export interface BatchUpload {
  id: number;
  user_id: number;
  project_id: number;
  status: BatchUploadStatus;
  total_items: number;
  completed_items: number;
  created_at: string;
}

/* -------------------------------------------------------------------------- */
/* Clips                                                                       */
/* -------------------------------------------------------------------------- */

export type ClipStatus = 'suggested' | 'draft' | 'rendered' | 'archived';

export type ClipAspectRatio = '9:16' | '1:1' | '16:9';

export type ClipReframeMode = 'auto' | 'manual';

export interface ClipCropConfig {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Clip {
  id: number;
  source_video_id: number;
  user_id: number;
  project_id: number;
  title: string;
  start_seconds: number;
  end_seconds: number;
  score: number;
  rank: number;
  status: ClipStatus;
  aspect_ratio: ClipAspectRatio;
  reframe_mode: ClipReframeMode;
  crop_config: ClipCropConfig | null;
  render_storage_key: string | null;
  created_at: string;
  updated_at: string;
}

export interface CaptionSegment {
  start: number;
  end: number;
  text: string;
}

export interface Caption {
  id: number;
  clip_id: number;
  segments: CaptionSegment[];
  style_preset_id: number | null;
  style_overrides: Record<string, string | number | boolean> | null;
}

export type ClipExportPreset = 'tiktok' | 'reels' | 'shorts' | 'custom';

export type ClipExportStatus = 'queued' | 'rendering' | 'ready' | 'failed';

export interface ClipExport {
  id: number;
  clip_id: number;
  preset: ClipExportPreset;
  resolution: string;
  format: string;
  storage_key: string | null;
  status: ClipExportStatus;
  download_url: string | null;
  created_at: string;
}

/* -------------------------------------------------------------------------- */
/* Library                                                                     */
/* -------------------------------------------------------------------------- */

export interface Tag {
  id: number;
  user_id: number;
  name: string;
  color: string;
}

export interface ClipVersion {
  id: number;
  clip_id: number;
  version_number: number;
  snapshot: Record<string, unknown>;
  render_storage_key: string | null;
  created_at: string;
  created_by: number;
}

export type DownloadBundleStatus =
  | 'queued'
  | 'rendering'
  | 'ready'
  | 'failed';

export interface DownloadBundle {
  id: number;
  user_id: number;
  clip_ids: number[];
  status: DownloadBundleStatus;
  storage_key: string | null;
  download_url: string | null;
  created_at: string;
}

/* -------------------------------------------------------------------------- */
/* Brand Kit                                                                   */
/* -------------------------------------------------------------------------- */

export type WatermarkPosition =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'center';

export interface BrandKit {
  id: number;
  user_id: number;
  name: string;
  is_default: boolean;
  primary_color: string;
  secondary_color: string;
  font_family: string;
  logo_storage_key: string | null;
  watermark_position: WatermarkPosition;
  created_at: string;
  updated_at: string;
}

export type CaptionAnimation = 'none' | 'pop' | 'karaoke' | 'fade';

export type CaptionBackgroundStyle = 'none' | 'solid' | 'outline' | 'shadow';

export type CaptionPosition = 'top' | 'middle' | 'bottom';

export interface CaptionStylePreset {
  id: number;
  user_id: number;
  brand_kit_id: number;
  name: string;
  font_family: string;
  font_size: number;
  text_color: string;
  highlight_color: string;
  background_style: CaptionBackgroundStyle;
  animation: CaptionAnimation;
  position: CaptionPosition;
  created_at: string;
}

/* -------------------------------------------------------------------------- */
/* Billing                                                                     */
/* -------------------------------------------------------------------------- */

export type SubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'incomplete';

export interface Subscription {
  id: number;
  user_id: number;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  plan: string;
  status: SubscriptionStatus;
  current_period_end: string | null;
  created_at: string;
  updated_at: string;
}

export interface UsageRecord {
  id: number;
  user_id: number;
  period_start: string;
  period_end: string;
  minutes_processed: number;
  clips_generated: number;
  storage_bytes: number;
}

/* -------------------------------------------------------------------------- */
/* Publishing                                                                  */
/* -------------------------------------------------------------------------- */

export type SocialPlatform =
  | 'tiktok'
  | 'instagram'
  | 'youtube'
  | 'slack'
  | 'teams';

export type SocialAccountStatus = 'connected' | 'expired' | 'revoked';

export interface SocialAccount {
  id: number;
  user_id: number;
  platform: SocialPlatform;
  external_account_id: string;
  display_name: string;
  token_expires_at: string | null;
  status: SocialAccountStatus;
  created_at: string;
}

export type PublishDestinationType = 'social' | 'slack' | 'teams' | 'link';

export type PublishJobStatus =
  | 'draft'
  | 'scheduled'
  | 'publishing'
  | 'published'
  | 'failed';

export interface PublishJob {
  id: number;
  clip_id: number;
  user_id: number;
  social_account_id: number | null;
  destination_type: PublishDestinationType;
  caption_text: string | null;
  scheduled_at: string | null;
  published_at: string | null;
  status: PublishJobStatus;
  external_post_id: string | null;
  /** Public URL for a completed `link` job; null for other destinations. */
  share_url: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface ShareLink {
  id: number;
  clip_id: number;
  user_id: number;
  slug: string;
  is_active: boolean;
  expires_at: string | null;
  view_count: number;
  created_at: string;
}

/* -------------------------------------------------------------------------- */
/* Dashboard                                                                   */
/* -------------------------------------------------------------------------- */

export type ActivityType =
  | 'video_uploaded'
  | 'processing_complete'
  | 'processing_failed'
  | 'clip_rendered'
  | 'clip_exported'
  | 'clip_published'
  | 'subscription_updated';

export interface ActivityItem {
  id: number;
  type: ActivityType;
  message: string;
  resource_id: number | null;
  resource_type: string | null;
  created_at: string;
}

export interface DashboardSummary {
  plan: string;
  minutes_processed: number;
  minutes_limit: number;
  clips_generated: number;
  storage_bytes: number;
  period_start: string;
  period_end: string;
  recent_activity: ActivityItem[];
}

/* -------------------------------------------------------------------------- */
/* Generic API helpers                                                         */
/* -------------------------------------------------------------------------- */

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface JobReference {
  job_id: number;
  status: string;
}

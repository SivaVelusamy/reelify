// Module 3 (Clips) — request/response shapes not covered by src/types/index.ts.
// New types for this module live here; index.ts is not edited.

import type {
  Caption,
  CaptionSegment,
  Clip,
  ClipAspectRatio,
  ClipCropConfig,
  ClipExportPreset,
  ClipReframeMode,
  ClipStatus,
} from './index';

/** GET /clips/{id} — clip detail, optionally embedding its caption track. */
export interface ClipDetail extends Clip {
  caption: Caption | null;
}

/** POST /videos/{id}/clips */
export interface CreateManualClipPayload {
  start_seconds: number;
  end_seconds: number;
  title?: string;
}

/** PUT /clips/{id} */
export interface UpdateClipPayload {
  start_seconds?: number;
  end_seconds?: number;
  title?: string;
  aspect_ratio?: ClipAspectRatio;
  reframe_mode?: ClipReframeMode;
  crop_config?: ClipCropConfig | null;
  status?: ClipStatus;
}

/** PUT /clips/{id}/captions */
export interface UpdateCaptionsPayload {
  segments: CaptionSegment[];
  style_preset_id?: number | null;
  style_overrides?: Record<string, string | number | boolean> | null;
}

/** GET /clips/{id}/preview */
export interface ClipPreview {
  url: string;
  poster_url?: string | null;
  aspect_ratio?: ClipAspectRatio;
}

/** POST /clips/{id}/export */
export interface CreateExportPayload {
  preset: ClipExportPreset;
  resolution?: string;
  format?: string;
}

/** POST /clips/{id}/render — async job handle. */
export interface RenderJob {
  status: string;
  job_id?: number;
}

export const CLIP_ASPECT_RATIOS: ClipAspectRatio[] = ['9:16', '1:1', '16:9'];

/** CSS aspect-ratio value for a clip aspect ratio. */
export const ASPECT_RATIO_CSS: Record<ClipAspectRatio, string> = {
  '9:16': '9 / 16',
  '1:1': '1 / 1',
  '16:9': '16 / 9',
};

export type ScoreLabel = 'Low' | 'Medium' | 'High' | 'Top';

export interface ExportPresetOption {
  value: ClipExportPreset;
  label: string;
  defaultResolution: string;
}

export const EXPORT_PRESETS: ExportPresetOption[] = [
  { value: 'tiktok', label: 'TikTok', defaultResolution: '1080x1920' },
  { value: 'reels', label: 'Instagram Reels', defaultResolution: '1080x1920' },
  { value: 'shorts', label: 'YouTube Shorts', defaultResolution: '1080x1920' },
  { value: 'custom', label: 'Custom', defaultResolution: '1080x1920' },
];

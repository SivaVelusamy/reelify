// Module 3 (Clips) — typed API wrappers over /api/v1.
import api from './api';
import type {
  CaptionStylePreset,
  Clip,
  ClipExport,
} from '../types';
import type {
  ClipDetail,
  ClipPreview,
  CreateExportPayload,
  CreateManualClipPayload,
  RenderJob,
  UpdateCaptionsPayload,
  UpdateClipPayload,
} from '../types/clips';

/** GET /videos/{id}/clips — ranked clip candidates for a source video. */
export async function listVideoClips(videoId: number): Promise<Clip[]> {
  const { data } = await api.get<Clip[]>(`/videos/${videoId}/clips`);
  return data;
}

/** POST /videos/{id}/clips — create a manual clip. */
export async function createManualClip(
  videoId: number,
  payload: CreateManualClipPayload,
): Promise<Clip> {
  const { data } = await api.post<Clip>(`/videos/${videoId}/clips`, payload);
  return data;
}

/** GET /clips/{id} — clip detail (with caption track when present). */
export async function getClip(clipId: number): Promise<ClipDetail> {
  const { data } = await api.get<ClipDetail>(`/clips/${clipId}`);
  return data;
}

/** PUT /clips/{id} — update trim / reframe / crop / title / status. */
export async function updateClip(
  clipId: number,
  payload: UpdateClipPayload,
): Promise<Clip> {
  const { data } = await api.put<Clip>(`/clips/${clipId}`, payload);
  return data;
}

/** PUT /clips/{id}/captions — replace caption segments + styling. */
export async function updateCaptions(
  clipId: number,
  payload: UpdateCaptionsPayload,
): Promise<ClipDetail> {
  const { data } = await api.put<ClipDetail>(`/clips/${clipId}/captions`, payload);
  return data;
}

/** POST /clips/{id}/render — kick off a render job. */
export async function renderClip(clipId: number): Promise<RenderJob> {
  const { data } = await api.post<RenderJob>(`/clips/${clipId}/render`, {});
  return data;
}

/** GET /clips/{id}/preview — low-res proxy preview URL. */
export async function getClipPreview(clipId: number): Promise<ClipPreview> {
  const { data } = await api.get<ClipPreview>(`/clips/${clipId}/preview`);
  return data;
}

/** POST /clips/{id}/export — export in a target preset/resolution. */
export async function createExport(
  clipId: number,
  payload: CreateExportPayload,
): Promise<ClipExport> {
  const { data } = await api.post<ClipExport>(`/clips/${clipId}/export`, payload);
  return data;
}

/** GET /exports/{id} — export job status + signed download URL. */
export async function getExport(exportId: number): Promise<ClipExport> {
  const { data } = await api.get<ClipExport>(`/exports/${exportId}`);
  return data;
}

/** DELETE /clips/{id} — delete / archive a clip. */
export async function deleteClip(clipId: number): Promise<void> {
  await api.delete(`/clips/${clipId}`);
}

/** GET /caption-presets — caption style presets available to the user. */
export async function listCaptionPresets(): Promise<CaptionStylePreset[]> {
  const { data } = await api.get<CaptionStylePreset[]>('/caption-presets');
  return data;
}

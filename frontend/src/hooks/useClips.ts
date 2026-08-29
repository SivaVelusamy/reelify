// Module 3 (Clips) — react-query v5 hooks.
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import type { CaptionStylePreset, Clip, ClipExport } from '../types';
import type {
  ClipDetail,
  ClipPreview,
  CreateExportPayload,
  CreateManualClipPayload,
  RenderJob,
  UpdateCaptionsPayload,
  UpdateClipPayload,
} from '../types/clips';
import {
  createExport,
  createManualClip,
  getClip,
  getClipPreview,
  getExport,
  listCaptionPresets,
  listVideoClips,
  renderClip,
  updateCaptions,
  updateClip,
} from '../services/clipService';

export const clipKeys = {
  candidates: (videoId: number) => ['clips', 'video', videoId] as const,
  detail: (clipId: number) => ['clips', 'detail', clipId] as const,
  preview: (clipId: number) => ['clips', 'preview', clipId] as const,
  export: (exportId: number) => ['clips', 'export', exportId] as const,
  captionPresets: ['caption-presets'] as const,
};

/** Ranked clip candidates for a source video. */
export function useClipCandidates(
  videoId: number,
): UseQueryResult<Clip[], Error> {
  return useQuery({
    queryKey: clipKeys.candidates(videoId),
    queryFn: () => listVideoClips(videoId),
    enabled: Number.isFinite(videoId) && videoId > 0,
  });
}

/** A single clip's detail (including its caption track). */
export function useClip(clipId: number): UseQueryResult<ClipDetail, Error> {
  return useQuery({
    queryKey: clipKeys.detail(clipId),
    queryFn: () => getClip(clipId),
    enabled: Number.isFinite(clipId) && clipId > 0,
  });
}

/** Preview proxy URL for a clip. */
export function useClipPreview(
  clipId: number,
): UseQueryResult<ClipPreview, Error> {
  return useQuery({
    queryKey: clipKeys.preview(clipId),
    queryFn: () => getClipPreview(clipId),
    enabled: Number.isFinite(clipId) && clipId > 0,
  });
}

/** Caption style presets (Brand Kit module 5, read-only here). */
export function useCaptionPresets(): UseQueryResult<CaptionStylePreset[], Error> {
  return useQuery({
    queryKey: clipKeys.captionPresets,
    queryFn: listCaptionPresets,
  });
}

/** Create a manual clip on a source video. */
export function useCreateManualClip(
  videoId: number,
): UseMutationResult<Clip, Error, CreateManualClipPayload> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateManualClipPayload) =>
      createManualClip(videoId, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: clipKeys.candidates(videoId) });
    },
  });
}

/** Update trim / reframe / crop / title / status of a clip. */
export function useUpdateClip(
  clipId: number,
): UseMutationResult<Clip, Error, UpdateClipPayload> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateClipPayload) => updateClip(clipId, payload),
    onSuccess: (clip) => {
      void qc.invalidateQueries({ queryKey: clipKeys.detail(clipId) });
      void qc.invalidateQueries({
        queryKey: clipKeys.candidates(clip.source_video_id),
      });
    },
  });
}

/** Replace caption segments + styling for a clip. */
export function useUpdateCaptions(
  clipId: number,
): UseMutationResult<ClipDetail, Error, UpdateCaptionsPayload> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateCaptionsPayload) =>
      updateCaptions(clipId, payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: clipKeys.detail(clipId) });
    },
  });
}

/** Kick off a render job for a clip. */
export function useRenderClip(
  clipId: number,
): UseMutationResult<RenderJob, Error, void> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => renderClip(clipId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: clipKeys.detail(clipId) });
    },
  });
}

/** Create an export job for a clip. */
export function useCreateExport(
  clipId: number,
): UseMutationResult<ClipExport, Error, CreateExportPayload> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateExportPayload) => createExport(clipId, payload),
    onSuccess: (created) => {
      void qc.invalidateQueries({ queryKey: clipKeys.export(created.id) });
    },
  });
}

const ACTIVE_EXPORT_STATUSES = new Set(['queued', 'rendering']);

/** Poll an export job while it is still queued / rendering. */
export function useExport(
  exportId: number | null,
): UseQueryResult<ClipExport, Error> {
  return useQuery({
    queryKey: clipKeys.export(exportId ?? 0),
    queryFn: () => getExport(exportId as number),
    enabled: exportId !== null && Number.isFinite(exportId) && exportId > 0,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && ACTIVE_EXPORT_STATUSES.has(status) ? 2500 : false;
    },
  });
}

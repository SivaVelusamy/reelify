// React Query v5 hooks for source videos, ingest and processing status.

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import {
  batchUploadVideos,
  deleteSourceVideo,
  getSourceVideo,
  getSourceVideoStatus,
  getTranscript,
  importVideoUrl,
  reprocessVideo,
  uploadVideoFile,
} from '../services/projectService';
import { projectKeys } from './useProjects';
import type { BatchUpload, SourceVideo, SourceVideoStatus, Transcript } from '../types';
import type { SourceVideoStatusResponse } from '../types/projects';

const TERMINAL_STATUSES: readonly SourceVideoStatus[] = ['ready', 'failed'];

export const videoKeys = {
  all: ['videos'] as const,
  detail: (id: number) => ['videos', 'detail', id] as const,
  status: (id: number) => ['videos', 'status', id] as const,
  transcript: (id: number) => ['videos', 'transcript', id] as const,
};

export function useSourceVideo(
  id: number | undefined,
): UseQueryResult<SourceVideo, Error> {
  return useQuery({
    queryKey: videoKeys.detail(id ?? 0),
    queryFn: () => getSourceVideo(id as number),
    enabled: typeof id === 'number' && Number.isFinite(id),
  });
}

export function useVideoStatus(
  id: number | undefined,
): UseQueryResult<SourceVideoStatusResponse, Error> {
  return useQuery({
    queryKey: videoKeys.status(id ?? 0),
    queryFn: () => getSourceVideoStatus(id as number),
    enabled: typeof id === 'number' && Number.isFinite(id),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      if (status && TERMINAL_STATUSES.includes(status)) {
        return false;
      }
      return 3000;
    },
  });
}

export function useTranscript(
  id: number | undefined,
  enabled = true,
): UseQueryResult<Transcript, Error> {
  return useQuery({
    queryKey: videoKeys.transcript(id ?? 0),
    queryFn: () => getTranscript(id as number),
    enabled: enabled && typeof id === 'number' && Number.isFinite(id),
  });
}

export function useReprocessVideo(): UseMutationResult<
  SourceVideo,
  Error,
  number
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => reprocessVideo(id),
    onSuccess: (video) => {
      void qc.invalidateQueries({ queryKey: videoKeys.detail(video.id) });
      void qc.invalidateQueries({ queryKey: videoKeys.status(video.id) });
      void qc.invalidateQueries({ queryKey: videoKeys.transcript(video.id) });
    },
  });
}

export function useDeleteVideo(): UseMutationResult<void, Error, number> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteSourceVideo(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: videoKeys.all });
      void qc.invalidateQueries({ queryKey: projectKeys.all });
    },
  });
}

export function useUploadVideo(
  projectId: number,
): UseMutationResult<SourceVideo, Error, File> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadVideoFile(projectId, file),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
    },
  });
}

export function useImportYouTube(
  projectId: number,
): UseMutationResult<SourceVideo, Error, string> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (url: string) => importVideoUrl(projectId, url),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
    },
  });
}

export function useBatchUpload(
  projectId: number,
): UseMutationResult<BatchUpload, Error, File[]> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (files: File[]) => batchUploadVideos(projectId, files),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: projectKeys.detail(projectId) });
    },
  });
}

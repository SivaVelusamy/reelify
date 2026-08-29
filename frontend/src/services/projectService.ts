// Typed API wrappers for the Projects / Uploads module (prefix: /api/v1).

import api from './api';
import type {
  BatchUpload,
  Project,
  SourceVideo,
  Transcript,
} from '../types';
import type {
  ProjectCreateInput,
  ProjectDetail,
  ProjectUpdateInput,
  SourceVideoStatusResponse,
} from '../types/projects';

/* -------------------------------------------------------------------------- */
/* Projects                                                                    */
/* -------------------------------------------------------------------------- */

export async function listProjects(): Promise<Project[]> {
  const { data } = await api.get<Project[]>('/projects');
  return data;
}

export async function getProject(id: number): Promise<ProjectDetail> {
  const { data } = await api.get<ProjectDetail>(`/projects/${id}`);
  return data;
}

export async function listProjectVideos(
  projectId: number,
): Promise<SourceVideo[]> {
  const { data } = await api.get<SourceVideo[]>(`/projects/${projectId}/videos`);
  return data;
}

export async function createProject(
  input: ProjectCreateInput,
): Promise<Project> {
  const { data } = await api.post<Project>('/projects', input);
  return data;
}

export async function updateProject(
  id: number,
  input: ProjectUpdateInput,
): Promise<Project> {
  const { data } = await api.put<Project>(`/projects/${id}`, input);
  return data;
}

export async function deleteProject(id: number): Promise<void> {
  await api.delete(`/projects/${id}`);
}

/* -------------------------------------------------------------------------- */
/* Source videos — ingest                                                      */
/* -------------------------------------------------------------------------- */

export async function uploadVideoFile(
  projectId: number,
  file: File,
): Promise<SourceVideo> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post<SourceVideo>(
    `/projects/${projectId}/videos`,
    form,
  );
  return data;
}

export async function importVideoUrl(
  projectId: number,
  url: string,
): Promise<SourceVideo> {
  const form = new FormData();
  form.append('url', url);
  const { data } = await api.post<SourceVideo>(
    `/projects/${projectId}/videos`,
    form,
  );
  return data;
}

export async function batchUploadVideos(
  projectId: number,
  files: File[],
): Promise<BatchUpload> {
  const form = new FormData();
  files.forEach((file) => form.append('files', file));
  const { data } = await api.post<BatchUpload>(
    `/projects/${projectId}/videos/batch`,
    form,
  );
  return data;
}

/* -------------------------------------------------------------------------- */
/* Source videos — read / lifecycle                                            */
/* -------------------------------------------------------------------------- */

export async function getSourceVideo(id: number): Promise<SourceVideo> {
  const { data } = await api.get<SourceVideo>(`/videos/${id}`);
  return data;
}

export async function getSourceVideoStatus(
  id: number,
): Promise<SourceVideoStatusResponse> {
  const { data } = await api.get<SourceVideoStatusResponse>(
    `/videos/${id}/status`,
  );
  return data;
}

export async function getTranscript(id: number): Promise<Transcript> {
  const { data } = await api.get<Transcript>(`/videos/${id}/transcript`);
  return data;
}

export async function reprocessVideo(id: number): Promise<SourceVideo> {
  const { data } = await api.post<SourceVideo>(`/videos/${id}/reprocess`);
  return data;
}

export async function deleteSourceVideo(id: number): Promise<void> {
  await api.delete(`/videos/${id}`);
}

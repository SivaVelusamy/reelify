// Module 4 (Library / Assets) — typed API wrappers over /api/v1.
import api from './api';
import type { ClipDetail } from '../types/clips';
import type {
  CreateTagPayload,
  DownloadBundle,
  LibraryFilters,
  PaginatedClips,
  SearchHit,
  Tag,
  ClipVersion,
} from '../types/library';

/** GET /library/clips — list/filter clips (project, tag, campaign, status). */
export async function listLibraryClips(
  filters: LibraryFilters,
): Promise<PaginatedClips> {
  const { data } = await api.get<PaginatedClips>('/library/clips', {
    params: {
      project_id: filters.project_id,
      tag_id: filters.tag_id,
      campaign: filters.campaign?.trim() || undefined,
      status: filters.status,
      page: filters.page ?? 1,
      per_page: filters.per_page ?? 24,
    },
  });
  return data;
}

/** GET /library/search?q= — ranked full-text hits over transcripts + titles. */
export async function searchLibrary(q: string): Promise<SearchHit[]> {
  const { data } = await api.get<SearchHit[]>('/library/search', {
    params: { q },
  });
  return data;
}

/** GET /tags — the current user's tags. */
export async function listTags(): Promise<Tag[]> {
  const { data } = await api.get<Tag[]>('/tags');
  return data;
}

/** POST /tags — create a tag. */
export async function createTag(payload: CreateTagPayload): Promise<Tag> {
  const { data } = await api.post<Tag>('/tags', payload);
  return data;
}

/** POST /clips/{id}/tags — attach/detach; send the full desired tag set. */
export async function setClipTags(
  clipId: number,
  tagIds: number[],
): Promise<Tag[]> {
  const { data } = await api.post<Tag[]>(`/clips/${clipId}/tags`, {
    tag_ids: tagIds,
  });
  return data;
}

/** GET /clips/{id}/versions — version history, newest first. */
export async function listClipVersions(clipId: number): Promise<ClipVersion[]> {
  const { data } = await api.get<ClipVersion[]>(`/clips/${clipId}/versions`);
  return data;
}

/** POST /clips/{id}/restore/{version} — restore a previous version. */
export async function restoreClipVersion(
  clipId: number,
  version: number,
): Promise<ClipDetail> {
  const { data } = await api.post<ClipDetail>(
    `/clips/${clipId}/restore/${version}`,
    {},
  );
  return data;
}

/** POST /library/bundles — create a bulk-download bundle (async job). */
export async function createBundle(clipIds: number[]): Promise<DownloadBundle> {
  const { data } = await api.post<DownloadBundle>('/library/bundles', {
    clip_ids: clipIds,
  });
  return data;
}

/** GET /library/bundles/{id} — bundle status + signed download URL. */
export async function getBundle(id: number): Promise<DownloadBundle> {
  const { data } = await api.get<DownloadBundle>(`/library/bundles/${id}`);
  return data;
}

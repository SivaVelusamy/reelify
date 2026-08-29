// Module 4 (Library / Assets) — react-query v5 hooks.
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
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
import {
  createBundle,
  createTag,
  getBundle,
  listClipVersions,
  listLibraryClips,
  listTags,
  restoreClipVersion,
  searchLibrary,
  setClipTags,
} from '../services/libraryService';

const ACTIVE_BUNDLE_STATUSES = new Set(['queued', 'rendering']);

export const libraryKeys = {
  clips: (filters: LibraryFilters) => ['library', 'clips', filters] as const,
  clipsRoot: ['library', 'clips'] as const,
  search: (q: string) => ['library', 'search', q] as const,
  tags: ['library', 'tags'] as const,
  versions: (clipId: number) => ['library', 'versions', clipId] as const,
  bundle: (id: number) => ['library', 'bundle', id] as const,
};

/** Paginated, filtered library clip grid. */
export function useLibraryClips(
  filters: LibraryFilters,
): UseQueryResult<PaginatedClips, Error> {
  return useQuery({
    queryKey: libraryKeys.clips(filters),
    queryFn: () => listLibraryClips(filters),
  });
}

/** Ranked transcript/title search. Enabled once the query is >= 2 chars. */
export function useLibrarySearch(q: string): UseQueryResult<SearchHit[], Error> {
  const trimmed = q.trim();
  return useQuery({
    queryKey: libraryKeys.search(trimmed),
    queryFn: () => searchLibrary(trimmed),
    enabled: trimmed.length >= 2,
  });
}

/** The current user's tags. */
export function useTags(): UseQueryResult<Tag[], Error> {
  return useQuery({ queryKey: libraryKeys.tags, queryFn: listTags });
}

/** Create a new tag. */
export function useCreateTag(): UseMutationResult<
  Tag,
  Error,
  CreateTagPayload
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateTagPayload) => createTag(payload),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: libraryKeys.tags });
    },
  });
}

/** Replace the full tag set on a clip. */
export function useSetClipTags(
  clipId: number,
): UseMutationResult<Tag[], Error, number[]> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (tagIds: number[]) => setClipTags(clipId, tagIds),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: libraryKeys.clipsRoot });
      void qc.invalidateQueries({ queryKey: ['clips', 'detail', clipId] });
    },
  });
}

/** Version history for a clip. */
export function useClipVersions(
  clipId: number,
): UseQueryResult<ClipVersion[], Error> {
  return useQuery({
    queryKey: libraryKeys.versions(clipId),
    queryFn: () => listClipVersions(clipId),
    enabled: Number.isFinite(clipId) && clipId > 0,
  });
}

/** Restore a previous version of a clip. */
export function useRestoreVersion(
  clipId: number,
): UseMutationResult<ClipDetail, Error, number> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (version: number) => restoreClipVersion(clipId, version),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: libraryKeys.versions(clipId) });
      void qc.invalidateQueries({ queryKey: ['clips', 'detail', clipId] });
    },
  });
}

/** Create a bulk-download bundle for a set of clips. */
export function useCreateBundle(): UseMutationResult<
  DownloadBundle,
  Error,
  number[]
> {
  return useMutation({
    mutationFn: (clipIds: number[]) => createBundle(clipIds),
  });
}

/** Poll a bundle job while it is still queued / building. */
export function useBundle(
  id: number | null,
): UseQueryResult<DownloadBundle, Error> {
  return useQuery({
    queryKey: libraryKeys.bundle(id ?? 0),
    queryFn: () => getBundle(id as number),
    enabled: id !== null && Number.isFinite(id) && id > 0,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && ACTIVE_BUNDLE_STATUSES.has(status) ? 2500 : false;
    },
  });
}

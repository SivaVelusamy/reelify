// Module 4 (Library / Assets) — request/response shapes not covered by
// src/types/index.ts. index.ts is not edited; new types live here.

import type { Clip, ClipStatus, DownloadBundle, ClipVersion, Tag } from './index';

// Re-export the shared library contracts so consumers can import them from one place.
export type { Tag, ClipVersion, DownloadBundle };

/** A clip as returned by GET /library/clips — enriched with its tags + project. */
export interface LibraryClip extends Clip {
  tags: Tag[];
  project_title: string;
}

/** GET /library/clips — paginated envelope. */
export interface PaginatedClips {
  items: LibraryClip[];
  total: number;
  page: number;
  per_page: number;
}

/** A single ranked hit from GET /library/search?q= */
export interface SearchHit {
  clip_id: number;
  title: string;
  /** May contain <mark> tags from the backend — always sanitized before render. */
  snippet: string;
  /** Where the query matched, e.g. "title" | "transcript" | "caption". */
  matched_in: string;
  rank: number;
}

/** Payload for POST /tags */
export interface CreateTagPayload {
  name: string;
  color: string;
}

/** Active filters for the library clip grid (maps to GET /library/clips query). */
export interface LibraryFilters {
  project_id?: number;
  tag_id?: number;
  campaign?: string;
  status?: ClipStatus;
  page?: number;
  per_page?: number;
}

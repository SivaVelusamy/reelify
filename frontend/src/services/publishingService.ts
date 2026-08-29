// Module 8 (Publishing / Distribution) — typed API wrappers over /api/v1.
//
// NOTE: getPublicClip() deliberately uses a bare axios call (no shared `api`
// instance) so the auth request/refresh interceptors never run — the /s/{slug}
// endpoint is public and the viewer is not logged in.

import axios from 'axios';
import api from './api';
import type {
  CalendarEntry,
  ConnectAccountResponse,
  DateRange,
  Platform,
  PublicClip,
  PublishInput,
  PublishJob,
  PublishJobFilters,
  ShareLinkResponse,
  UpdatePublishJobInput,
} from '../types/publishing';
import type { SocialAccount } from '../types';

const PUBLIC_API_ROOT = `${import.meta.env.VITE_API_URL ?? ''}/api/v1`;

/* -------------------------------------------------------------------------- */
/* Social accounts                                                             */
/* -------------------------------------------------------------------------- */

/** GET /social-accounts — connected social / chat accounts. */
export async function listSocialAccounts(): Promise<SocialAccount[]> {
  const { data } = await api.get<SocialAccount[]>('/social-accounts');
  return data;
}

/** POST /social-accounts/connect/{platform} — begin an OAuth connect. */
export async function connectSocialAccount(
  platform: Platform,
): Promise<ConnectAccountResponse> {
  const { data } = await api.post<ConnectAccountResponse>(
    `/social-accounts/connect/${platform}`,
  );
  return data;
}

/** DELETE /social-accounts/{id} — disconnect an account. */
export async function disconnectSocialAccount(id: number): Promise<void> {
  await api.delete(`/social-accounts/${id}`);
}

/* -------------------------------------------------------------------------- */
/* Publish jobs                                                                */
/* -------------------------------------------------------------------------- */

/** POST /clips/{id}/publish — publish now or schedule to a destination. */
export async function publishClip(
  clipId: number,
  input: PublishInput,
): Promise<PublishJob> {
  const { data } = await api.post<PublishJob>(`/clips/${clipId}/publish`, input);
  return data;
}

/** GET /publish-jobs — list publish jobs, optionally filtered. */
export async function listPublishJobs(
  filters: PublishJobFilters = {},
): Promise<PublishJob[]> {
  const { data } = await api.get<PublishJob[]>('/publish-jobs', {
    params: filters,
  });
  return data;
}

/** PUT /publish-jobs/{id} — reschedule / edit a scheduled job. */
export async function updatePublishJob(
  id: number,
  input: UpdatePublishJobInput,
): Promise<PublishJob> {
  const { data } = await api.put<PublishJob>(`/publish-jobs/${id}`, input);
  return data;
}

/** DELETE /publish-jobs/{id} — cancel a scheduled job. */
export async function cancelPublishJob(id: number): Promise<void> {
  await api.delete(`/publish-jobs/${id}`);
}

/** GET /publish/calendar?from=&to= — calendar view of scheduled jobs. */
export async function getPublishCalendar(
  range: DateRange,
): Promise<CalendarEntry[]> {
  const { data } = await api.get<CalendarEntry[]>('/publish/calendar', {
    params: range,
  });
  return data;
}

/* -------------------------------------------------------------------------- */
/* Share links                                                                 */
/* -------------------------------------------------------------------------- */

/** POST /clips/{id}/share-link — create (or return) a public share link. */
export async function createShareLink(
  clipId: number,
): Promise<ShareLinkResponse> {
  const { data } = await api.post<ShareLinkResponse>(
    `/clips/${clipId}/share-link`,
    {},
  );
  return data;
}

/* -------------------------------------------------------------------------- */
/* Public clip — UNAUTHENTICATED (no interceptor)                              */
/* -------------------------------------------------------------------------- */

/**
 * GET /s/{slug} — public clip payload. Uses the bare `axios` default instance,
 * NOT the shared `api` client, so no Authorization header or refresh logic runs.
 */
export async function getPublicClip(slug: string): Promise<PublicClip> {
  const { data } = await axios.get<PublicClip>(
    `${PUBLIC_API_ROOT}/s/${encodeURIComponent(slug)}`,
  );
  return data;
}

// Module 8 (Publishing / Distribution) — react-query v5 hooks.

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import {
  cancelPublishJob,
  connectSocialAccount,
  createShareLink,
  disconnectSocialAccount,
  getPublishCalendar,
  listPublishJobs,
  listSocialAccounts,
  publishClip,
  updatePublishJob,
} from '../services/publishingService';
import type { SocialAccount } from '../types';
import type {
  CalendarEntry,
  ConnectAccountResponse,
  DateRange,
  Platform,
  PublishInput,
  PublishJob,
  PublishJobFilters,
  ShareLinkResponse,
  UpdatePublishJobInput,
} from '../types/publishing';

export const publishingKeys = {
  socialAccounts: ['social-accounts'] as const,
  publishJobs: (filters: PublishJobFilters) =>
    ['publish-jobs', filters] as const,
  calendar: (range: DateRange) => ['publish-calendar', range] as const,
};

/* -------------------------------------------------------------------------- */
/* Social accounts                                                             */
/* -------------------------------------------------------------------------- */

export function useSocialAccounts(): UseQueryResult<SocialAccount[], Error> {
  return useQuery({
    queryKey: publishingKeys.socialAccounts,
    queryFn: listSocialAccounts,
  });
}

/**
 * Starts an OAuth connect. On success the browser is redirected to the
 * provider's `auth_url`; the backend callback later returns the user to
 * /settings/connections?connected=<platform>.
 */
export function useConnectAccount(): UseMutationResult<
  ConnectAccountResponse,
  Error,
  Platform
> {
  return useMutation({
    mutationFn: (platform: Platform) => connectSocialAccount(platform),
    onSuccess: (data) => {
      window.location.assign(data.auth_url);
    },
  });
}

export function useDisconnectAccount(): UseMutationResult<void, Error, number> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => disconnectSocialAccount(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: publishingKeys.socialAccounts });
    },
  });
}

/* -------------------------------------------------------------------------- */
/* Publish jobs                                                                */
/* -------------------------------------------------------------------------- */

export function usePublishJobs(
  filters: PublishJobFilters = {},
): UseQueryResult<PublishJob[], Error> {
  return useQuery({
    queryKey: publishingKeys.publishJobs(filters),
    queryFn: () => listPublishJobs(filters),
  });
}

export function usePublishClip(
  clipId: number,
): UseMutationResult<PublishJob, Error, PublishInput> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: PublishInput) => publishClip(clipId, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['publish-jobs'] });
      void qc.invalidateQueries({ queryKey: ['publish-calendar'] });
    },
  });
}

export function useUpdatePublishJob(): UseMutationResult<
  PublishJob,
  Error,
  { id: number; input: UpdatePublishJobInput }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdatePublishJobInput }) =>
      updatePublishJob(id, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['publish-jobs'] });
      void qc.invalidateQueries({ queryKey: ['publish-calendar'] });
    },
  });
}

export function useCancelPublishJob(): UseMutationResult<void, Error, number> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => cancelPublishJob(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['publish-jobs'] });
      void qc.invalidateQueries({ queryKey: ['publish-calendar'] });
    },
  });
}

/* -------------------------------------------------------------------------- */
/* Calendar                                                                    */
/* -------------------------------------------------------------------------- */

export function usePublishCalendar(
  range: DateRange,
): UseQueryResult<CalendarEntry[], Error> {
  return useQuery({
    queryKey: publishingKeys.calendar(range),
    queryFn: () => getPublishCalendar(range),
    enabled: Boolean(range.from && range.to),
  });
}

/* -------------------------------------------------------------------------- */
/* Share links                                                                 */
/* -------------------------------------------------------------------------- */

export function useCreateShareLink(
  clipId: number,
): UseMutationResult<ShareLinkResponse, Error, void> {
  return useMutation({
    mutationFn: () => createShareLink(clipId),
  });
}

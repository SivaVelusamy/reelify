// React Query v5 hooks for the Dashboard module.

import {
  keepPreviousData,
  useQuery,
  type UseQueryResult,
} from '@tanstack/react-query';
import { getActivity, getSummary } from '../services/dashboardService';
import type { DashboardSummary, PaginatedActivity } from '../types/dashboard';

export const dashboardKeys = {
  all: ['dashboard'] as const,
  summary: () => ['dashboard', 'summary'] as const,
  activity: (page: number, perPage: number) =>
    ['dashboard', 'activity', page, perPage] as const,
};

export function useDashboardSummary(): UseQueryResult<DashboardSummary, Error> {
  return useQuery({
    queryKey: dashboardKeys.summary(),
    queryFn: () => getSummary(),
    staleTime: 30_000,
  });
}

export function useActivityFeed(
  page = 1,
  perPage = 20,
): UseQueryResult<PaginatedActivity, Error> {
  return useQuery({
    queryKey: dashboardKeys.activity(page, perPage),
    queryFn: () => getActivity(page, perPage),
    placeholderData: keepPreviousData,
  });
}

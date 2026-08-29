// Module 9 (Admin Panel) — react-query v5 hooks over adminService.

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import {
  getJobs,
  getStats,
  getUser,
  listUsers,
  updateUser,
} from '../services/adminService';
import type {
  AdminUserDetail,
  AdminUserFilters,
  AdminUserUpdate,
  JobQueueHealth,
  PaginatedUsers,
  PlatformStats,
} from '../types/admin';

export const adminKeys = {
  users: (filters: AdminUserFilters) => ['admin', 'users', filters] as const,
  user: (id: number) => ['admin', 'users', 'detail', id] as const,
  stats: ['admin', 'stats'] as const,
  jobs: ['admin', 'jobs'] as const,
};

/** Paginated / filtered user list. */
export function useAdminUsers(
  filters: AdminUserFilters = {},
): UseQueryResult<PaginatedUsers, Error> {
  return useQuery({
    queryKey: adminKeys.users(filters),
    queryFn: () => listUsers(filters),
  });
}

/** Single user detail. Disabled until `id` is a positive number. */
export function useAdminUser(
  id: number | null,
): UseQueryResult<AdminUserDetail, Error> {
  return useQuery({
    queryKey: adminKeys.user(id ?? 0),
    queryFn: () => getUser(id as number),
    enabled: typeof id === 'number' && id > 0,
  });
}

/** Mutation: update a user's status / admin flag / plan. */
export function useUpdateAdminUser(): UseMutationResult<
  AdminUserDetail,
  Error,
  { id: number; patch: AdminUserUpdate }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: number; patch: AdminUserUpdate }) =>
      updateUser(id, patch),
    onSuccess: (detail) => {
      qc.setQueryData(adminKeys.user(detail.id), detail);
      void qc.invalidateQueries({ queryKey: ['admin', 'users'] });
      void qc.invalidateQueries({ queryKey: adminKeys.stats });
    },
  });
}

/** Platform stats. */
export function useAdminStats(): UseQueryResult<PlatformStats, Error> {
  return useQuery({
    queryKey: adminKeys.stats,
    queryFn: getStats,
  });
}

/** Job queue health — auto-refreshes every 15s. */
export function useAdminJobs(): UseQueryResult<JobQueueHealth, Error> {
  return useQuery({
    queryKey: adminKeys.jobs,
    queryFn: getJobs,
    refetchInterval: 15000,
  });
}

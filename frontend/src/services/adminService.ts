// Module 9 (Admin Panel) — typed API wrappers over /api/v1/admin/*.
// All endpoints require the caller to be an admin (backend returns 403 / 422).

import api from './api';
import type {
  AdminUserDetail,
  AdminUserFilters,
  AdminUserUpdate,
  JobQueueHealth,
  PaginatedUsers,
  PlatformStats,
} from '../types/admin';

/** GET /admin/users — list / search / filter users (paginated). */
export async function listUsers(
  filters: AdminUserFilters = {},
): Promise<PaginatedUsers> {
  const { data } = await api.get<PaginatedUsers>('/admin/users', {
    params: filters,
  });
  return data;
}

/** GET /admin/users/{id} — user detail with usage counters. */
export async function getUser(id: number): Promise<AdminUserDetail> {
  const { data } = await api.get<AdminUserDetail>(`/admin/users/${id}`);
  return data;
}

/** PUT /admin/users/{id} — update status / admin flag / plan. */
export async function updateUser(
  id: number,
  patch: AdminUserUpdate,
): Promise<AdminUserDetail> {
  const { data } = await api.put<AdminUserDetail>(`/admin/users/${id}`, patch);
  return data;
}

/** GET /admin/stats — platform-wide metrics. */
export async function getStats(): Promise<PlatformStats> {
  const { data } = await api.get<PlatformStats>('/admin/stats');
  return data;
}

/** GET /admin/jobs — processing queue health. */
export async function getJobs(): Promise<JobQueueHealth> {
  const { data } = await api.get<JobQueueHealth>('/admin/jobs');
  return data;
}

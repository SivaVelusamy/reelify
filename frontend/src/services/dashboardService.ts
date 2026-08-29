// Typed API wrappers for the Dashboard module (prefix: /api/v1).

import api from './api';
import type { DashboardSummary, PaginatedActivity } from '../types/dashboard';

export async function getSummary(): Promise<DashboardSummary> {
  const { data } = await api.get<DashboardSummary>('/dashboard/summary');
  return data;
}

export async function getActivity(
  page = 1,
  perPage = 20,
): Promise<PaginatedActivity> {
  const { data } = await api.get<PaginatedActivity>('/dashboard/activity', {
    params: { page, per_page: perPage },
  });
  return data;
}

// React Query v5 hooks for projects.

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import {
  createProject,
  deleteProject,
  getProject,
  listProjectVideos,
  listProjects,
  updateProject,
} from '../services/projectService';
import type { Project, SourceVideo } from '../types';
import type {
  ProjectCreateInput,
  ProjectDetail,
  ProjectUpdateInput,
} from '../types/projects';

export const projectKeys = {
  all: ['projects'] as const,
  list: () => ['projects', 'list'] as const,
  detail: (id: number) => ['projects', 'detail', id] as const,
  videos: (id: number) => ['projects', 'detail', id, 'videos'] as const,
};

export function useProjects(): UseQueryResult<Project[], Error> {
  return useQuery({
    queryKey: projectKeys.list(),
    queryFn: () => listProjects(),
  });
}

export function useProjectVideos(
  id: number | undefined,
): UseQueryResult<SourceVideo[], Error> {
  return useQuery({
    queryKey: projectKeys.videos(id ?? 0),
    queryFn: () => listProjectVideos(id as number),
    enabled: typeof id === 'number' && Number.isFinite(id),
  });
}

export function useProject(
  id: number | undefined,
): UseQueryResult<ProjectDetail, Error> {
  return useQuery({
    queryKey: projectKeys.detail(id ?? 0),
    queryFn: () => getProject(id as number),
    enabled: typeof id === 'number' && Number.isFinite(id),
  });
}

export function useCreateProject(): UseMutationResult<
  Project,
  Error,
  ProjectCreateInput
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ProjectCreateInput) => createProject(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: projectKeys.all });
    },
  });
}

export function useUpdateProject(): UseMutationResult<
  Project,
  Error,
  { id: number; input: ProjectUpdateInput }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: ProjectUpdateInput }) =>
      updateProject(id, input),
    onSuccess: (project) => {
      void qc.invalidateQueries({ queryKey: projectKeys.all });
      void qc.invalidateQueries({ queryKey: projectKeys.detail(project.id) });
    },
  });
}

export function useDeleteProject(): UseMutationResult<void, Error, number> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteProject(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: projectKeys.all });
    },
  });
}

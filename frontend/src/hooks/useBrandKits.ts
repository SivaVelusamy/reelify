// Module 5 (Templates / Brand Kit) — react-query v5 hooks for brand kits.

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import {
  createBrandKit,
  deleteBrandKit,
  getBrandKit,
  listBrandKits,
  updateBrandKit,
  uploadBrandKitLogo,
} from '../services/brandService';
import type { BrandKit, BrandKitInput } from '../types/brand';

export const brandKitKeys = {
  all: ['brand-kits'] as const,
  detail: (id: number) => ['brand-kits', 'detail', id] as const,
};

/** Every brand kit owned by the user. */
export function useBrandKits(): UseQueryResult<BrandKit[], Error> {
  return useQuery({
    queryKey: brandKitKeys.all,
    queryFn: listBrandKits,
  });
}

/** A single brand kit. */
export function useBrandKit(
  id: number | undefined,
): UseQueryResult<BrandKit, Error> {
  return useQuery({
    queryKey: brandKitKeys.detail(id ?? 0),
    queryFn: () => getBrandKit(id as number),
    enabled: typeof id === 'number' && Number.isFinite(id) && id > 0,
  });
}

/** Create a brand kit. */
export function useCreateBrandKit(): UseMutationResult<
  BrandKit,
  Error,
  BrandKitInput
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: BrandKitInput) => createBrandKit(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: brandKitKeys.all });
    },
  });
}

/** Update a brand kit. */
export function useUpdateBrandKit(): UseMutationResult<
  BrandKit,
  Error,
  { id: number; input: BrandKitInput }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: BrandKitInput }) =>
      updateBrandKit(id, input),
    onSuccess: (kit) => {
      void qc.invalidateQueries({ queryKey: brandKitKeys.all });
      void qc.invalidateQueries({ queryKey: brandKitKeys.detail(kit.id) });
    },
  });
}

/** Delete a brand kit. */
export function useDeleteBrandKit(): UseMutationResult<void, Error, number> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteBrandKit(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: brandKitKeys.all });
    },
  });
}

/** Upload a logo / watermark asset for a specific brand kit. */
export function useUploadLogo(
  id: number,
): UseMutationResult<BrandKit, Error, File> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => uploadBrandKitLogo(id, file),
    onSuccess: (kit) => {
      void qc.invalidateQueries({ queryKey: brandKitKeys.all });
      void qc.invalidateQueries({ queryKey: brandKitKeys.detail(kit.id) });
    },
  });
}

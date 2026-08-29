// Module 5 (Templates / Brand Kit) — react-query v5 hooks for caption presets.
//
// The base query key ['caption-presets'] is SHARED with the Clips module
// (see clipKeys.captionPresets in hooks/useClips.ts). Every mutation here
// invalidates that base key so the Clips caption-style picker stays fresh.

import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import {
  createCaptionPreset,
  deleteCaptionPreset,
  listCaptionPresets,
  updateCaptionPreset,
} from '../services/brandService';
import type {
  CaptionStylePreset,
  CaptionStylePresetInput,
} from '../types/brand';

/** Shared base key — keep in sync with clipKeys.captionPresets. */
export const captionPresetKeys = {
  all: ['caption-presets'] as const,
  byBrandKit: (brandKitId: number) =>
    ['caption-presets', brandKitId] as const,
};

/** Caption style presets, optionally scoped to a single brand kit. */
export function useCaptionPresets(
  brandKitId?: number,
): UseQueryResult<CaptionStylePreset[], Error> {
  return useQuery({
    queryKey:
      typeof brandKitId === 'number'
        ? captionPresetKeys.byBrandKit(brandKitId)
        : captionPresetKeys.all,
    queryFn: () => listCaptionPresets(brandKitId),
  });
}

/** Create a caption style preset. */
export function useCreateCaptionPreset(): UseMutationResult<
  CaptionStylePreset,
  Error,
  CaptionStylePresetInput
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CaptionStylePresetInput) => createCaptionPreset(input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: captionPresetKeys.all });
    },
  });
}

/** Update a caption style preset. */
export function useUpdateCaptionPreset(): UseMutationResult<
  CaptionStylePreset,
  Error,
  { id: number; input: CaptionStylePresetInput }
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: number;
      input: CaptionStylePresetInput;
    }) => updateCaptionPreset(id, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: captionPresetKeys.all });
    },
  });
}

/** Delete a caption style preset. */
export function useDeleteCaptionPreset(): UseMutationResult<
  void,
  Error,
  number
> {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => deleteCaptionPreset(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: captionPresetKeys.all });
    },
  });
}

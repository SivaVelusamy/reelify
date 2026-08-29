// Module 5 (Templates / Brand Kit) — typed API wrappers over /api/v1.

import api from './api';
import type {
  BrandKit,
  BrandKitInput,
  CaptionStylePreset,
  CaptionStylePresetInput,
} from '../types/brand';

/* -------------------------------------------------------------------------- */
/* Brand kits                                                                  */
/* -------------------------------------------------------------------------- */

/** GET /brand-kits — every brand kit owned by the user. */
export async function listBrandKits(): Promise<BrandKit[]> {
  const { data } = await api.get<BrandKit[]>('/brand-kits');
  return data;
}

/** GET /brand-kits/{id} — a single brand kit. */
export async function getBrandKit(id: number): Promise<BrandKit> {
  const { data } = await api.get<BrandKit>(`/brand-kits/${id}`);
  return data;
}

/** POST /brand-kits — create a brand kit. */
export async function createBrandKit(input: BrandKitInput): Promise<BrandKit> {
  const { data } = await api.post<BrandKit>('/brand-kits', input);
  return data;
}

/** PUT /brand-kits/{id} — update a brand kit. */
export async function updateBrandKit(
  id: number,
  input: BrandKitInput,
): Promise<BrandKit> {
  const { data } = await api.put<BrandKit>(`/brand-kits/${id}`, input);
  return data;
}

/** DELETE /brand-kits/{id} — remove a brand kit. */
export async function deleteBrandKit(id: number): Promise<void> {
  await api.delete(`/brand-kits/${id}`);
}

/** POST /brand-kits/{id}/logo — upload a logo / watermark asset (multipart). */
export async function uploadBrandKitLogo(
  id: number,
  file: File,
): Promise<BrandKit> {
  const form = new FormData();
  form.append('file', file);
  const { data } = await api.post<BrandKit>(`/brand-kits/${id}/logo`, form);
  return data;
}

/* -------------------------------------------------------------------------- */
/* Caption style presets                                                       */
/* -------------------------------------------------------------------------- */

/** GET /caption-presets — optionally scoped to one brand kit. */
export async function listCaptionPresets(
  brandKitId?: number,
): Promise<CaptionStylePreset[]> {
  const { data } = await api.get<CaptionStylePreset[]>('/caption-presets', {
    params:
      typeof brandKitId === 'number' ? { brand_kit_id: brandKitId } : undefined,
  });
  return data;
}

/** POST /caption-presets — create a caption style preset. */
export async function createCaptionPreset(
  input: CaptionStylePresetInput,
): Promise<CaptionStylePreset> {
  const { data } = await api.post<CaptionStylePreset>('/caption-presets', input);
  return data;
}

/** PUT /caption-presets/{id} — update a caption style preset. */
export async function updateCaptionPreset(
  id: number,
  input: CaptionStylePresetInput,
): Promise<CaptionStylePreset> {
  const { data } = await api.put<CaptionStylePreset>(
    `/caption-presets/${id}`,
    input,
  );
  return data;
}

/** DELETE /caption-presets/{id} — remove a caption style preset. */
export async function deleteCaptionPreset(id: number): Promise<void> {
  await api.delete(`/caption-presets/${id}`);
}

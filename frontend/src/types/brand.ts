// Module 5 (Templates / Brand Kit) — request/response shapes.
// New types for this module live here; src/types/index.ts is not edited.

/* -------------------------------------------------------------------------- */
/* Unions (mirror backend Literals in app/schemas/brand.py)                    */
/* -------------------------------------------------------------------------- */

export type WatermarkPosition =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'center';

export type BackgroundStyle = 'none' | 'solid' | 'outline' | 'shadow';

export type CaptionAnimation = 'none' | 'pop' | 'karaoke' | 'fade';

export type CaptionPosition = 'top' | 'middle' | 'bottom';

export const WATERMARK_POSITIONS: readonly WatermarkPosition[] = [
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
  'center',
];

export const BACKGROUND_STYLES: readonly BackgroundStyle[] = [
  'none',
  'solid',
  'outline',
  'shadow',
];

export const CAPTION_ANIMATIONS: readonly CaptionAnimation[] = [
  'none',
  'pop',
  'karaoke',
  'fade',
];

export const CAPTION_POSITIONS: readonly CaptionPosition[] = [
  'top',
  'middle',
  'bottom',
];

/** Curated font-family options offered across the module. */
export const BRAND_FONTS: readonly string[] = [
  'Inter',
  'Roboto',
  'Montserrat',
  'Poppins',
  'Open Sans',
  'Lato',
  'system-ui',
];

/* -------------------------------------------------------------------------- */
/* Brand kit                                                                   */
/* -------------------------------------------------------------------------- */

export interface BrandKit {
  id: number;
  user_id: number;
  name: string;
  is_default: boolean;
  primary_color: string | null;
  secondary_color: string | null;
  font_family: string | null;
  logo_storage_key: string | null;
  logo_url: string | null;
  watermark_position: WatermarkPosition | null;
  created_at: string | null;
  updated_at: string | null;
}

/** Body for POST /brand-kits and PUT /brand-kits/{id}. */
export interface BrandKitInput {
  name: string;
  is_default?: boolean;
  primary_color?: string | null;
  secondary_color?: string | null;
  font_family?: string | null;
  watermark_position?: WatermarkPosition | null;
}

/* -------------------------------------------------------------------------- */
/* Caption style preset                                                        */
/* -------------------------------------------------------------------------- */

export interface CaptionStylePreset {
  id: number;
  user_id: number;
  brand_kit_id: number | null;
  name: string;
  font_family: string | null;
  font_size: number | null;
  text_color: string | null;
  highlight_color: string | null;
  background_style: BackgroundStyle | null;
  animation: CaptionAnimation;
  position: CaptionPosition | null;
  created_at: string | null;
}

/** Body for POST /caption-presets and PUT /caption-presets/{id}. */
export interface CaptionStylePresetInput {
  brand_kit_id?: number | null;
  name: string;
  font_family?: string | null;
  font_size?: number | null;
  text_color?: string | null;
  highlight_color?: string | null;
  background_style?: BackgroundStyle | null;
  animation?: CaptionAnimation;
  position?: CaptionPosition | null;
}

/** Shape LiveCaptionPreview needs to render a sample caption. */
export interface CaptionStyleValues {
  font_family: string | null;
  font_size: number | null;
  text_color: string | null;
  highlight_color: string | null;
  background_style: BackgroundStyle | null;
  animation: CaptionAnimation;
  position: CaptionPosition | null;
}

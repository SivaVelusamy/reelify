import { useState, type FormEvent } from 'react';
import { GradientButton } from '../ui/GradientButton';
import { AnimatedInput } from '../ui/AnimatedInput';
import { ColorField } from './ColorField';
import { FontField } from './FontField';
import {
  WATERMARK_POSITIONS,
  type BrandKit,
  type BrandKitInput,
  type WatermarkPosition,
} from '../../types/brand';

interface BrandKitFormProps {
  initial?: BrandKit;
  onSubmit: (input: BrandKitInput) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const DEFAULT_PRIMARY = '#7C3AED';
const DEFAULT_SECONDARY = '#EC4899';

const WATERMARK_LABELS: Record<WatermarkPosition, string> = {
  'top-left': 'Top left',
  'top-right': 'Top right',
  'bottom-left': 'Bottom left',
  'bottom-right': 'Bottom right',
  center: 'Center',
};

export function BrandKitForm({
  initial,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: BrandKitFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [primaryColor, setPrimaryColor] = useState(
    initial?.primary_color ?? DEFAULT_PRIMARY,
  );
  const [secondaryColor, setSecondaryColor] = useState(
    initial?.secondary_color ?? DEFAULT_SECONDARY,
  );
  const [fontFamily, setFontFamily] = useState(
    initial?.font_family ?? 'Inter',
  );
  const [watermarkPosition, setWatermarkPosition] = useState<WatermarkPosition>(
    initial?.watermark_position ?? 'bottom-right',
  );
  const [isDefault, setIsDefault] = useState(initial?.is_default ?? false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('A brand kit name is required.');
      return;
    }
    if (!HEX_RE.test(primaryColor.trim()) || !HEX_RE.test(secondaryColor.trim())) {
      setError('Both colors must be valid hex values.');
      return;
    }

    try {
      await onSubmit({
        name: name.trim(),
        is_default: isDefault,
        primary_color: primaryColor.trim(),
        secondary_color: secondaryColor.trim(),
        font_family: fontFamily,
        watermark_position: watermarkPosition,
      });
    } catch {
      setError('Could not save the brand kit. Please try again.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <AnimatedInput
        id="brand-kit-name"
        label="Name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        placeholder="Main brand"
        autoFocus
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <ColorField
          label="Primary color"
          value={primaryColor}
          onChange={setPrimaryColor}
        />
        <ColorField
          label="Secondary color"
          value={secondaryColor}
          onChange={setSecondaryColor}
        />
      </div>

      <FontField value={fontFamily} onChange={setFontFamily} />

      <div className="w-full">
        <label
          htmlFor="brand-kit-watermark"
          className="mb-1 block text-sm font-medium text-slate-700"
        >
          Watermark position
        </label>
        <select
          id="brand-kit-watermark"
          value={watermarkPosition}
          onChange={(event) =>
            setWatermarkPosition(event.target.value as WatermarkPosition)
          }
          className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition-colors focus:border-brand-500"
        >
          {WATERMARK_POSITIONS.map((position) => (
            <option key={position} value={position}>
              {WATERMARK_LABELS[position]}
            </option>
          ))}
        </select>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          checked={isDefault}
          onChange={(event) => setIsDefault(event.target.checked)}
          className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
        />
        Use as my default brand kit
      </label>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
        >
          Cancel
        </button>
        <GradientButton type="submit" isLoading={isSubmitting}>
          {initial ? 'Save changes' : 'Create brand kit'}
        </GradientButton>
      </div>
    </form>
  );
}

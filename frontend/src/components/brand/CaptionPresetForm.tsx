import { useState, type FormEvent } from 'react';
import { GradientButton } from '../ui/GradientButton';
import { AnimatedInput } from '../ui/AnimatedInput';
import { ColorField } from './ColorField';
import { FontField } from './FontField';
import { LiveCaptionPreview } from './LiveCaptionPreview';
import {
  BACKGROUND_STYLES,
  CAPTION_ANIMATIONS,
  CAPTION_POSITIONS,
  type BackgroundStyle,
  type CaptionAnimation,
  type CaptionPosition,
  type CaptionStylePreset,
  type CaptionStylePresetInput,
} from '../../types/brand';

interface CaptionPresetFormProps {
  brandKitId: number;
  initial?: CaptionStylePreset;
  onSubmit: (input: CaptionStylePresetInput) => Promise<void>;
  onCancel: () => void;
  isSubmitting?: boolean;
}

const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function CaptionPresetForm({
  brandKitId,
  initial,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: CaptionPresetFormProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [fontFamily, setFontFamily] = useState(initial?.font_family ?? 'Inter');
  const [fontSize, setFontSize] = useState<number>(initial?.font_size ?? 32);
  const [textColor, setTextColor] = useState(initial?.text_color ?? '#FFFFFF');
  const [highlightColor, setHighlightColor] = useState(
    initial?.highlight_color ?? '#FACC15',
  );
  const [backgroundStyle, setBackgroundStyle] = useState<BackgroundStyle>(
    initial?.background_style ?? 'none',
  );
  const [animation, setAnimation] = useState<CaptionAnimation>(
    initial?.animation ?? 'none',
  );
  const [position, setPosition] = useState<CaptionPosition>(
    initial?.position ?? 'bottom',
  );
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('A preset name is required.');
      return;
    }
    if (!HEX_RE.test(textColor.trim()) || !HEX_RE.test(highlightColor.trim())) {
      setError('Text and highlight colors must be valid hex values.');
      return;
    }
    if (!Number.isFinite(fontSize) || fontSize < 1 || fontSize > 400) {
      setError('Font size must be between 1 and 400.');
      return;
    }

    try {
      await onSubmit({
        brand_kit_id: brandKitId,
        name: name.trim(),
        font_family: fontFamily,
        font_size: fontSize,
        text_color: textColor.trim(),
        highlight_color: highlightColor.trim(),
        background_style: backgroundStyle,
        animation,
        position,
      });
    } catch {
      setError('Could not save the preset. Please try again.');
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-[1fr_260px]">
      <form onSubmit={handleSubmit} className="space-y-4">
        <AnimatedInput
          id="preset-name"
          label="Preset name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Bold yellow"
          autoFocus
        />

        <FontField value={fontFamily} onChange={setFontFamily} />

        <AnimatedInput
          id="preset-font-size"
          label="Font size (px)"
          type="number"
          min={1}
          max={400}
          value={String(fontSize)}
          onChange={(event) => setFontSize(Number(event.target.value))}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <ColorField
            label="Text color"
            value={textColor}
            onChange={setTextColor}
          />
          <ColorField
            label="Highlight color"
            value={highlightColor}
            onChange={setHighlightColor}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="w-full">
            <label
              htmlFor="preset-background"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Background
            </label>
            <select
              id="preset-background"
              value={backgroundStyle}
              onChange={(event) =>
                setBackgroundStyle(event.target.value as BackgroundStyle)
              }
              className="w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-500"
            >
              {BACKGROUND_STYLES.map((style) => (
                <option key={style} value={style}>
                  {titleCase(style)}
                </option>
              ))}
            </select>
          </div>

          <div className="w-full">
            <label
              htmlFor="preset-animation"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Animation
            </label>
            <select
              id="preset-animation"
              value={animation}
              onChange={(event) =>
                setAnimation(event.target.value as CaptionAnimation)
              }
              className="w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-500"
            >
              {CAPTION_ANIMATIONS.map((value) => (
                <option key={value} value={value}>
                  {titleCase(value)}
                </option>
              ))}
            </select>
          </div>

          <div className="w-full">
            <label
              htmlFor="preset-position"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Position
            </label>
            <select
              id="preset-position"
              value={position}
              onChange={(event) =>
                setPosition(event.target.value as CaptionPosition)
              }
              className="w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-500"
            >
              {CAPTION_POSITIONS.map((value) => (
                <option key={value} value={value}>
                  {titleCase(value)}
                </option>
              ))}
            </select>
          </div>
        </div>

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
            {initial ? 'Save changes' : 'Create preset'}
          </GradientButton>
        </div>
      </form>

      <div className="md:pt-6">
        <LiveCaptionPreview
          values={{
            font_family: fontFamily,
            font_size: fontSize,
            text_color: textColor,
            highlight_color: highlightColor,
            background_style: backgroundStyle,
            animation,
            position,
          }}
        />
      </div>
    </div>
  );
}

import { useMemo, type CSSProperties } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import { Spinner } from '../ui/Spinner';
import { useCaptionPresets } from '../../hooks/useClips';
import type { CaptionSegment, CaptionStylePreset } from '../../types';

interface CaptionEditorProps {
  segments: CaptionSegment[];
  onSegmentsChange: (segments: CaptionSegment[]) => void;
  stylePresetId: number | null;
  onStylePresetChange: (presetId: number | null) => void;
  className?: string;
}

function previewStyle(preset: CaptionStylePreset | undefined): CSSProperties {
  if (!preset) {
    return {
      fontFamily: 'Inter, system-ui, sans-serif',
      fontSize: 20,
      color: '#ffffff',
    };
  }
  const base: CSSProperties = {
    fontFamily: preset.font_family,
    fontSize: preset.font_size,
    color: preset.text_color,
  };
  if (preset.background_style === 'solid') {
    base.backgroundColor = 'rgba(0,0,0,0.7)';
    base.padding = '4px 10px';
    base.borderRadius = 8;
  } else if (preset.background_style === 'outline') {
    base.textShadow =
      '-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000';
  } else if (preset.background_style === 'shadow') {
    base.textShadow = '0 2px 6px rgba(0,0,0,0.8)';
  }
  return base;
}

export function CaptionEditor({
  segments,
  onSegmentsChange,
  stylePresetId,
  onStylePresetChange,
  className,
}: CaptionEditorProps) {
  const { data: presets, isLoading } = useCaptionPresets();

  const activePreset = useMemo(
    () => (presets ?? []).find((p) => p.id === stylePresetId),
    [presets, stylePresetId],
  );

  const style = useMemo(() => previewStyle(activePreset), [activePreset]);
  const previewText = segments[0]?.text?.trim() || 'Your captions preview here';

  const updateSegment = (index: number, patch: Partial<CaptionSegment>): void => {
    onSegmentsChange(
      segments.map((seg, i) => (i === index ? { ...seg, ...patch } : seg)),
    );
  };

  const removeSegment = (index: number): void => {
    onSegmentsChange(segments.filter((_, i) => i !== index));
  };

  const addSegment = (): void => {
    const last = segments[segments.length - 1];
    const start = last ? last.end : 0;
    onSegmentsChange([...segments, { start, end: start + 2, text: '' }]);
  };

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <div className="flex flex-col gap-1.5">
        <label
          htmlFor="caption-style-preset"
          className="text-sm font-medium text-slate-700"
        >
          Caption style preset
        </label>
        <div className="flex items-center gap-2">
          <select
            id="caption-style-preset"
            value={stylePresetId ?? ''}
            onChange={(e) =>
              onStylePresetChange(e.target.value ? Number(e.target.value) : null)
            }
            className="rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
          >
            <option value="">Default</option>
            {(presets ?? []).map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.name}
              </option>
            ))}
          </select>
          {isLoading && <Spinner size={16} />}
        </div>
      </div>

      <div
        className="flex min-h-[96px] items-end justify-center rounded-xl bg-slate-900 p-4"
        aria-label="Caption preview"
      >
        <span style={style} className="text-center font-semibold leading-tight">
          {previewText}
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {segments.map((seg, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-slate-200 bg-white p-3"
          >
            <div className="mb-2 flex items-center gap-2">
              <input
                type="number"
                step={0.1}
                min={0}
                value={seg.start}
                onChange={(e) =>
                  updateSegment(index, { start: Number(e.target.value) })
                }
                aria-label={`Segment ${index + 1} start`}
                className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-sm outline-none focus:border-brand-500"
              />
              <span className="text-slate-400">→</span>
              <input
                type="number"
                step={0.1}
                min={0}
                value={seg.end}
                onChange={(e) =>
                  updateSegment(index, { end: Number(e.target.value) })
                }
                aria-label={`Segment ${index + 1} end`}
                className="w-20 rounded-lg border border-slate-200 px-2 py-1 text-sm outline-none focus:border-brand-500"
              />
              <button
                type="button"
                onClick={() => removeSegment(index)}
                aria-label={`Remove segment ${index + 1}`}
                className="ml-auto rounded-lg p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
              >
                <Trash2 size={16} />
              </button>
            </div>
            <textarea
              value={seg.text}
              onChange={(e) => updateSegment(index, { text: e.target.value })}
              aria-label={`Segment ${index + 1} text`}
              rows={2}
              className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-brand-500"
            />
          </motion.div>
        ))}
      </div>

      <button
        type="button"
        onClick={addSegment}
        className="inline-flex items-center gap-1.5 self-start rounded-full border border-brand-200 px-4 py-1.5 text-sm font-semibold text-brand-700 hover:bg-brand-50"
      >
        <Plus size={16} />
        Add segment
      </button>
    </div>
  );
}

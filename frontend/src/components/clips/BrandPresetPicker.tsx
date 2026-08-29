import { motion } from 'framer-motion';
import { Check } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Spinner } from '../ui/Spinner';
import { useCaptionPresets } from '../../hooks/useClips';

interface BrandPresetPickerProps {
  value: number | null;
  onChange: (presetId: number | null) => void;
  className?: string;
}

export function BrandPresetPicker({
  value,
  onChange,
  className,
}: BrandPresetPickerProps) {
  const { data: presets, isLoading, isError } = useCaptionPresets();

  if (isLoading) {
    return (
      <div className={cn('flex items-center gap-2 text-sm text-slate-500', className)}>
        <Spinner size={18} />
        Loading presets…
      </div>
    );
  }

  if (isError) {
    return (
      <p className={cn('text-sm text-red-600', className)}>
        Could not load caption style presets.
      </p>
    );
  }

  const list = presets ?? [];

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <span className="text-sm font-medium text-slate-700">Brand caption style</span>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onChange(null)}
          className={cn(
            'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
            value === null
              ? 'border-brand-500 bg-brand-50 text-brand-700'
              : 'border-slate-200 text-slate-600 hover:bg-slate-50',
          )}
        >
          None
        </button>
        {list.map((preset) => (
          <motion.button
            key={preset.id}
            type="button"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            onClick={() => onChange(preset.id)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
              value === preset.id
                ? 'border-brand-500 bg-brand-50 text-brand-700'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50',
            )}
          >
            {value === preset.id && <Check size={14} />}
            {preset.name}
          </motion.button>
        ))}
        {list.length === 0 && (
          <span className="text-sm text-slate-400">
            No presets yet — create one in Brand Kit settings.
          </span>
        )}
      </div>
    </div>
  );
}

import { useId } from 'react';
import { cn } from '../../lib/utils';

interface ColorFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  className?: string;
}

const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/** Normalise arbitrary input toward a `#rrggbb` string for the color input. */
function toSwatchValue(raw: string): string {
  const trimmed = raw.trim();
  return HEX_RE.test(trimmed) ? trimmed : '#000000';
}

/**
 * Hex text input paired with a live swatch and a native `<input type="color">`.
 * Emits the raw text so the parent can validate; invalid hex is flagged.
 */
export function ColorField({
  label,
  value,
  onChange,
  error,
  className,
}: ColorFieldProps) {
  const textId = useId();
  const pickerId = useId();
  const invalid = value.trim().length > 0 && !HEX_RE.test(value.trim());

  return (
    <div className={cn('w-full', className)}>
      <label
        htmlFor={textId}
        className="mb-1 block text-sm font-medium text-slate-700"
      >
        {label}
      </label>
      <div className="flex items-center gap-2">
        <label
          htmlFor={pickerId}
          className="relative h-10 w-10 shrink-0 cursor-pointer overflow-hidden rounded-xl border-2 border-slate-200"
          style={{ backgroundColor: toSwatchValue(value) }}
          aria-label={`${label} swatch`}
        >
          <input
            id={pickerId}
            type="color"
            value={toSwatchValue(value)}
            onChange={(event) => onChange(event.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </label>
        <input
          id={textId}
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="#7C3AED"
          spellCheck={false}
          className={cn(
            'w-full rounded-xl border-2 bg-white px-4 py-2.5 font-mono text-sm uppercase outline-none transition-colors',
            invalid || error
              ? 'border-red-500 focus:border-red-500'
              : 'border-slate-200 focus:border-brand-500',
          )}
        />
      </div>
      {(error || invalid) && (
        <p className="mt-1 text-sm text-red-500">
          {error ?? 'Enter a hex color like #7C3AED.'}
        </p>
      )}
    </div>
  );
}

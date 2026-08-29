import { useId } from 'react';
import { cn } from '../../lib/utils';
import { BRAND_FONTS } from '../../types/brand';

interface FontFieldProps {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

/** Curated font-family `<select>`; the chosen option previews in its own face. */
export function FontField({
  label = 'Font family',
  value,
  onChange,
  className,
}: FontFieldProps) {
  const id = useId();
  const options = BRAND_FONTS.includes(value)
    ? BRAND_FONTS
    : [value, ...BRAND_FONTS];

  return (
    <div className={cn('w-full', className)}>
      <label
        htmlFor={id}
        className="mb-1 block text-sm font-medium text-slate-700"
      >
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={{ fontFamily: value }}
        className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition-colors focus:border-brand-500"
      >
        {options.map((font) => (
          <option key={font} value={font} style={{ fontFamily: font }}>
            {font}
          </option>
        ))}
      </select>
    </div>
  );
}

import { motion } from 'framer-motion';
import type { CSSProperties } from 'react';
import { cn } from '../../lib/utils';
import type {
  BackgroundStyle,
  CaptionAnimation,
  CaptionPosition,
  CaptionStyleValues,
} from '../../types/brand';

interface LiveCaptionPreviewProps {
  values: CaptionStyleValues;
  sampleText?: string;
  className?: string;
}

const DEFAULT_SAMPLE = 'This is how your captions will look';
const FALLBACK_TEXT = '#FFFFFF';
const FALLBACK_HIGHLIGHT = '#FACC15';

const POSITION_CLASS: Record<CaptionPosition, string> = {
  top: 'items-start pt-6',
  middle: 'items-center',
  bottom: 'items-end pb-6',
};

const ANIMATION_LABEL: Record<CaptionAnimation, string> = {
  none: 'No animation',
  pop: 'Pop in',
  karaoke: 'Karaoke highlight',
  fade: 'Fade in',
};

function backgroundCss(
  style: BackgroundStyle,
  fontSize: number,
): CSSProperties {
  switch (style) {
    case 'solid':
      return {
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        padding: `${fontSize * 0.2}px ${fontSize * 0.4}px`,
        borderRadius: `${fontSize * 0.2}px`,
      };
    case 'outline':
      return {
        WebkitTextStroke: `${Math.max(1, fontSize * 0.06)}px #0F172A`,
        paintOrder: 'stroke fill',
      };
    case 'shadow':
      return {
        textShadow: `0 ${fontSize * 0.06}px ${fontSize * 0.12}px rgba(0,0,0,0.6)`,
      };
    case 'none':
    default:
      return {};
  }
}

const ANIMATION_MOTION: Record<
  CaptionAnimation,
  { initial: Record<string, number>; animate: Record<string, number> }
> = {
  none: { initial: { opacity: 1 }, animate: { opacity: 1 } },
  pop: { initial: { opacity: 0, scale: 0.6 }, animate: { opacity: 1, scale: 1 } },
  karaoke: { initial: { opacity: 1 }, animate: { opacity: 1 } },
  fade: { initial: { opacity: 0 }, animate: { opacity: 1 } },
};

/** Pure, prop-driven preview of a caption style over a stand-in video frame. */
export function LiveCaptionPreview({
  values,
  sampleText = DEFAULT_SAMPLE,
  className,
}: LiveCaptionPreviewProps) {
  const fontSize = values.font_size ?? 28;
  const textColor = values.text_color ?? FALLBACK_TEXT;
  const highlightColor = values.highlight_color ?? FALLBACK_HIGHLIGHT;
  const fontFamily = values.font_family ?? 'Inter';
  const position = values.position ?? 'bottom';
  const backgroundStyle = values.background_style ?? 'none';
  const animation = values.animation ?? 'none';

  const words = sampleText.split(' ');
  const highlightIndex = Math.min(2, Math.max(0, words.length - 1));
  const motionSpec = ANIMATION_MOTION[animation];

  // Preview box is a fixed height; scale the caption down to fit sensibly.
  const previewFontSize = Math.min(fontSize, 34);

  return (
    <div className={cn('w-full', className)}>
      <div
        className={cn(
          'relative mx-auto flex aspect-[9/16] max-h-[460px] w-full max-w-[260px] justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900 px-4',
          POSITION_CLASS[position],
        )}
      >
        <motion.p
          key={`${animation}-${sampleText}`}
          initial={motionSpec.initial}
          animate={motionSpec.animate}
          transition={{ duration: 0.4 }}
          className="max-w-full text-center font-bold leading-tight"
          style={{
            fontFamily,
            fontSize: `${previewFontSize}px`,
            color: textColor,
            ...backgroundCss(backgroundStyle, previewFontSize),
          }}
        >
          {words.map((word, index) => (
            <span
              key={`${word}-${index}`}
              style={
                (animation === 'karaoke' && index <= highlightIndex) ||
                (animation !== 'karaoke' && index === highlightIndex)
                  ? { color: highlightColor }
                  : undefined
              }
            >
              {word}
              {index < words.length - 1 ? ' ' : ''}
            </span>
          ))}
        </motion.p>
      </div>
      <p className="mt-2 text-center text-xs text-slate-500">
        {ANIMATION_LABEL[animation]} · {position} · {backgroundStyle}
      </p>
    </div>
  );
}

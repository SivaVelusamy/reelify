import {
  useCallback,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';
import {
  ASPECT_RATIO_CSS,
  CLIP_ASPECT_RATIOS,
} from '../../types/clips';
import type {
  ClipAspectRatio,
  ClipCropConfig,
  ClipReframeMode,
} from '../../types';

interface ReframeControlProps {
  aspectRatio: ClipAspectRatio;
  reframeMode: ClipReframeMode;
  cropConfig: ClipCropConfig | null;
  /** Still frame to position the crop box over (manual mode). */
  stillUrl?: string | null;
  onAspectRatioChange: (ratio: ClipAspectRatio) => void;
  onReframeModeChange: (mode: ClipReframeMode) => void;
  onCropConfigChange: (crop: ClipCropConfig) => void;
  className?: string;
}

const DEFAULT_CROP: ClipCropConfig = { x: 0.25, y: 0, width: 0.5, height: 1 };

export function ReframeControl({
  aspectRatio,
  reframeMode,
  cropConfig,
  stillUrl,
  onAspectRatioChange,
  onReframeModeChange,
  onCropConfigChange,
  className,
}: ReframeControlProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const crop = cropConfig ?? DEFAULT_CROP;

  const moveBox = useCallback(
    (clientX: number, clientY: number): void => {
      const frame = frameRef.current;
      if (!frame) {
        return;
      }
      const rect = frame.getBoundingClientRect();
      const relX = (clientX - rect.left) / rect.width;
      const relY = (clientY - rect.top) / rect.height;
      const x = Math.min(Math.max(relX - crop.width / 2, 0), 1 - crop.width);
      const y = Math.min(Math.max(relY - crop.height / 2, 0), 1 - crop.height);
      onCropConfigChange({
        x: Number(x.toFixed(4)),
        y: Number(y.toFixed(4)),
        width: crop.width,
        height: crop.height,
      });
    },
    [crop.width, crop.height, onCropConfigChange],
  );

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>): void => {
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    moveBox(event.clientX, event.clientY);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (!dragging) {
      return;
    }
    moveBox(event.clientX, event.clientY);
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>): void => {
    event.currentTarget.releasePointerCapture(event.pointerId);
    setDragging(false);
  };

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      <div>
        <span className="mb-2 block text-sm font-medium text-slate-700">
          Aspect ratio
        </span>
        <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
          {CLIP_ASPECT_RATIOS.map((ratio) => (
            <motion.button
              key={ratio}
              type="button"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onAspectRatioChange(ratio)}
              aria-pressed={ratio === aspectRatio}
              className={cn(
                'rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors',
                ratio === aspectRatio
                  ? 'bg-brand-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100',
              )}
            >
              {ratio}
            </motion.button>
          ))}
        </div>
      </div>

      <div>
        <span className="mb-2 block text-sm font-medium text-slate-700">
          Reframe
        </span>
        <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
          {(['auto', 'manual'] as ClipReframeMode[]).map((mode) => (
            <motion.button
              key={mode}
              type="button"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => onReframeModeChange(mode)}
              aria-pressed={mode === reframeMode}
              className={cn(
                'rounded-lg px-4 py-1.5 text-sm font-semibold capitalize transition-colors',
                mode === reframeMode
                  ? 'bg-brand-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100',
              )}
            >
              {mode}
            </motion.button>
          ))}
        </div>
      </div>

      {reframeMode === 'manual' && (
        <div>
          <span className="mb-2 block text-sm font-medium text-slate-700">
            Drag to position the crop
          </span>
          <div
            ref={frameRef}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            className="relative aspect-video w-full max-w-md touch-none overflow-hidden rounded-xl bg-slate-800 select-none"
          >
            {stillUrl ? (
              <img
                src={stillUrl}
                alt="Clip still for reframing"
                draggable={false}
                className="pointer-events-none h-full w-full object-cover opacity-80"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                No still available
              </div>
            )}
            <div
              className="absolute border-2 border-white/90 bg-white/10 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]"
              style={{
                left: `${crop.x * 100}%`,
                top: `${crop.y * 100}%`,
                width: `${crop.width * 100}%`,
                height: `${crop.height * 100}%`,
                aspectRatio: ASPECT_RATIO_CSS[aspectRatio],
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

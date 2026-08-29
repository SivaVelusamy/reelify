import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Pause, Play } from 'lucide-react';
import { cn, formatDuration } from '../../lib/utils';
import { ASPECT_RATIO_CSS } from '../../types/clips';
import type { ClipAspectRatio } from '../../types';

interface PreviewPlayerProps {
  src: string;
  aspectRatio?: ClipAspectRatio;
  poster?: string | null;
  className?: string;
}

export function PreviewPlayer({
  src,
  aspectRatio = '9:16',
  poster,
  className,
}: PreviewPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    const onTime = (): void => setCurrentTime(video.currentTime);
    const onMeta = (): void => setDuration(video.duration || 0);
    const onPlay = (): void => setIsPlaying(true);
    const onPause = (): void => setIsPlaying(false);
    video.addEventListener('timeupdate', onTime);
    video.addEventListener('loadedmetadata', onMeta);
    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    return () => {
      video.removeEventListener('timeupdate', onTime);
      video.removeEventListener('loadedmetadata', onMeta);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
    };
  }, [src]);

  const toggle = useCallback((): void => {
    const video = videoRef.current;
    if (!video) {
      return;
    }
    if (video.paused) {
      void video.play();
    } else {
      video.pause();
    }
  }, []);

  return (
    <div className={cn('flex flex-col items-center gap-3', className)}>
      <div
        className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-black shadow-xl"
        style={{ aspectRatio: ASPECT_RATIO_CSS[aspectRatio] }}
      >
        <video
          ref={videoRef}
          src={src}
          poster={poster ?? undefined}
          playsInline
          className="h-full w-full object-contain"
        />
        <button
          type="button"
          onClick={toggle}
          aria-label={isPlaying ? 'Pause preview' : 'Play preview'}
          className="absolute inset-0 flex items-center justify-center bg-black/0 text-white transition-colors hover:bg-black/20"
        >
          <motion.span
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            className="rounded-full bg-black/50 p-3 backdrop-blur-sm"
          >
            {isPlaying ? <Pause size={22} /> : <Play size={22} />}
          </motion.span>
        </button>
      </div>

      <p className="font-mono text-sm text-slate-500" aria-live="polite">
        {formatDuration(currentTime)} / {formatDuration(duration)}
      </p>
    </div>
  );
}

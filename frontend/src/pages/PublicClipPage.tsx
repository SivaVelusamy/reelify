import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MeshBackground } from '../components/layout/MeshBackground';
import { Spinner } from '../components/ui/Spinner';
import { getPublicClip } from '../services/publishingService';
import type { PublicClip } from '../types/publishing';
import { formatDuration } from '../lib/utils';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; clip: PublicClip }
  | { status: 'error' };

export default function PublicClipPage() {
  const { slug } = useParams<{ slug: string }>();
  const [state, setState] = useState<LoadState>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    if (!slug) {
      setState({ status: 'error' });
      return () => {
        active = false;
      };
    }
    setState({ status: 'loading' });
    getPublicClip(slug)
      .then((clip) => {
        if (active) {
          setState({ status: 'ready', clip });
        }
      })
      .catch(() => {
        if (active) {
          setState({ status: 'error' });
        }
      });
    return () => {
      active = false;
    };
  }, [slug]);

  return (
    <>
      <MeshBackground />
      <div className="flex min-h-screen flex-col items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full max-w-md rounded-2xl border border-white/40 bg-white/70 p-6 text-center shadow-xl backdrop-blur-lg"
        >
          {state.status === 'loading' && (
            <div className="flex justify-center py-16">
              <Spinner size={32} />
            </div>
          )}

          {state.status === 'error' && (
            <div className="py-12">
              <h1 className="text-lg font-semibold text-slate-900">
                Link unavailable
              </h1>
              <p className="mt-2 text-sm text-slate-500">
                This share link has expired or does not exist.
              </p>
            </div>
          )}

          {state.status === 'ready' && (
            <div className="flex flex-col gap-4">
              <video
                controls
                playsInline
                src={state.clip.video_url}
                className="mx-auto max-h-[70vh] w-full rounded-xl bg-black"
              >
                <track kind="captions" />
              </video>
              <div>
                <h1 className="text-lg font-semibold text-slate-900">
                  {state.clip.title}
                </h1>
                {Number.isFinite(state.clip.duration) &&
                  state.clip.duration > 0 && (
                    <p className="mt-1 text-sm text-slate-500">
                      {formatDuration(state.clip.duration)}
                    </p>
                  )}
              </div>
            </div>
          )}
        </motion.div>

        <footer className="mt-6 text-sm font-semibold text-slate-500">
          Made with{' '}
          <span className="bg-brand-gradient bg-clip-text text-transparent">
            Reelify
          </span>
        </footer>
      </div>
    </>
  );
}

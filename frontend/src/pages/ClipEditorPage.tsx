import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { PageWrapper } from '../components/layout/PageWrapper';
import { GlassCard } from '../components/ui/GlassCard';
import { GradientButton } from '../components/ui/GradientButton';
import { AnimatedInput } from '../components/ui/AnimatedInput';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Spinner } from '../components/ui/Spinner';
import { PreviewPlayer } from '../components/clips/PreviewPlayer';
import { TrimBar, type TrimRange } from '../components/clips/TrimBar';
import { ReframeControl } from '../components/clips/ReframeControl';
import { CaptionEditor } from '../components/clips/CaptionEditor';
import { BrandPresetPicker } from '../components/clips/BrandPresetPicker';
import {
  useClip,
  useClipPreview,
  useRenderClip,
  useUpdateCaptions,
  useUpdateClip,
} from '../hooks/useClips';
import type {
  CaptionSegment,
  ClipAspectRatio,
  ClipCropConfig,
  ClipReframeMode,
} from '../types';

interface EditorState {
  title: string;
  trim: TrimRange;
  aspectRatio: ClipAspectRatio;
  reframeMode: ClipReframeMode;
  cropConfig: ClipCropConfig | null;
  segments: CaptionSegment[];
  stylePresetId: number | null;
}

export default function ClipEditorPage() {
  const { id } = useParams<{ id: string }>();
  const clipId = Number(id);

  const { data: clip, isLoading, isError } = useClip(clipId);
  const { data: preview } = useClipPreview(clipId);
  const updateClip = useUpdateClip(clipId);
  const updateCaptions = useUpdateCaptions(clipId);
  const renderClip = useRenderClip(clipId);

  const [state, setState] = useState<EditorState | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!clip) {
      return;
    }
    setState({
      title: clip.title,
      trim: { start: clip.start_seconds, end: clip.end_seconds },
      aspectRatio: clip.aspect_ratio,
      reframeMode: clip.reframe_mode,
      cropConfig: clip.crop_config,
      segments: clip.caption?.segments ?? [],
      stylePresetId: clip.caption?.style_preset_id ?? null,
    });
  }, [clip]);

  const patch = (next: Partial<EditorState>): void => {
    setState((prev) => (prev ? { ...prev, ...next } : prev));
    setSaved(false);
  };

  const handleSave = async (): Promise<void> => {
    if (!state) {
      return;
    }
    setSaveError(null);
    try {
      await updateClip.mutateAsync({
        title: state.title,
        start_seconds: state.trim.start,
        end_seconds: state.trim.end,
        aspect_ratio: state.aspectRatio,
        reframe_mode: state.reframeMode,
        crop_config: state.reframeMode === 'manual' ? state.cropConfig : null,
      });
      await updateCaptions.mutateAsync({
        segments: state.segments,
        style_preset_id: state.stylePresetId,
      });
      setSaved(true);
    } catch {
      setSaveError('Could not save changes. Please try again.');
    }
  };

  const handleRender = async (): Promise<void> => {
    setSaveError(null);
    try {
      await renderClip.mutateAsync();
    } catch {
      setSaveError('Could not start the render. Please try again.');
    }
  };

  if (isLoading || !state) {
    return (
      <PageWrapper title="Clip editor">
        <div className="flex justify-center py-16">
          <Spinner size={32} />
        </div>
      </PageWrapper>
    );
  }

  if (isError || !clip) {
    return (
      <PageWrapper title="Clip editor">
        <GlassCard>
          <p className="text-sm text-red-600">Could not load this clip.</p>
        </GlassCard>
      </PageWrapper>
    );
  }

  const sourceDuration = Math.max(
    clip.end_seconds + 60,
    Math.ceil(clip.end_seconds * 1.5),
  );

  return (
    <PageWrapper title="Clip editor">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <StatusBadge status={clip.status} />
        <div className="ml-auto flex flex-wrap gap-3">
          <GradientButton
            type="button"
            onClick={handleSave}
            isLoading={updateClip.isPending || updateCaptions.isPending}
          >
            Save
          </GradientButton>
          <GradientButton
            type="button"
            onClick={handleRender}
            isLoading={renderClip.isPending}
            className="from-slate-700 to-slate-900"
          >
            Render
          </GradientButton>
          <Link
            to={`/clips/${clipId}/export`}
            className="inline-flex items-center rounded-full border border-brand-300 px-6 py-3 text-sm font-semibold text-brand-700 hover:bg-brand-50"
          >
            Export
          </Link>
          <Link
            to={`/clips/${clipId}/publish`}
            className="inline-flex items-center rounded-full border border-brand-300 px-6 py-3 text-sm font-semibold text-brand-700 hover:bg-brand-50"
          >
            Publish
          </Link>
        </div>
      </div>

      {saveError && (
        <p className="mb-3 text-sm text-red-600" role="alert">
          {saveError}
        </p>
      )}
      {saved && !saveError && (
        <p className="mb-3 text-sm text-emerald-600">Changes saved.</p>
      )}
      {renderClip.isSuccess && (
        <p className="mb-3 text-sm text-slate-600">
          Render started — this clip updates when it finishes.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <GlassCard className="flex items-start justify-center">
          {preview?.url ? (
            <PreviewPlayer
              src={preview.url}
              aspectRatio={state.aspectRatio}
              poster={preview.poster_url}
            />
          ) : (
            <div className="flex h-64 items-center justify-center text-sm text-slate-500">
              <Spinner size={20} />
              <span className="ml-2">Loading preview…</span>
            </div>
          )}
        </GlassCard>

        <div className="flex flex-col gap-6">
          <GlassCard className="flex flex-col gap-4">
            <AnimatedInput
              id="clip-editor-title"
              label="Title"
              value={state.title}
              onChange={(e) => patch({ title: e.target.value })}
            />
            <div>
              <span className="mb-2 block text-sm font-medium text-slate-700">
                Trim
              </span>
              <TrimBar
                sourceDuration={sourceDuration}
                value={state.trim}
                onChange={(trim) => patch({ trim })}
              />
            </div>
          </GlassCard>

          <GlassCard>
            <ReframeControl
              aspectRatio={state.aspectRatio}
              reframeMode={state.reframeMode}
              cropConfig={state.cropConfig}
              stillUrl={preview?.poster_url}
              onAspectRatioChange={(aspectRatio) => patch({ aspectRatio })}
              onReframeModeChange={(reframeMode) => patch({ reframeMode })}
              onCropConfigChange={(cropConfig) => patch({ cropConfig })}
            />
          </GlassCard>

          <GlassCard>
            <CaptionEditor
              segments={state.segments}
              onSegmentsChange={(segments) => patch({ segments })}
              stylePresetId={state.stylePresetId}
              onStylePresetChange={(stylePresetId) => patch({ stylePresetId })}
            />
          </GlassCard>

          <GlassCard>
            <BrandPresetPicker
              value={state.stylePresetId}
              onChange={(stylePresetId) => patch({ stylePresetId })}
            />
          </GlassCard>
        </div>
      </div>
    </PageWrapper>
  );
}

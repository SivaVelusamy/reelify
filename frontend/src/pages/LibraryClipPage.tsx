import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Download } from 'lucide-react';
import { PageWrapper } from '../components/layout/PageWrapper';
import { GlassCard } from '../components/ui/GlassCard';
import { GradientButton } from '../components/ui/GradientButton';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Spinner } from '../components/ui/Spinner';
import { EmptyState } from '../components/ui/EmptyState';
import { VersionHistoryList } from '../components/library/VersionHistoryList';
import { useClip } from '../hooks/useClips';
import {
  useBundle,
  useCreateBundle,
  useSetClipTags,
  useTags,
} from '../hooks/useLibrary';
import { cn, formatDuration } from '../lib/utils';
import type { ClipDetail } from '../types/clips';
import type { Tag } from '../types/library';

type LibraryClipDetail = ClipDetail & {
  tags?: Tag[];
  project_title?: string;
};

export default function LibraryClipPage() {
  const { id } = useParams<{ id: string }>();
  const clipId = Number(id);

  const clipQuery = useClip(clipId);
  const detail = clipQuery.data as LibraryClipDetail | undefined;

  const { data: allTags } = useTags();
  const setTags = useSetClipTags(clipId);
  const createBundle = useCreateBundle();

  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [tagError, setTagError] = useState<string | null>(null);
  const [bundleId, setBundleId] = useState<number | null>(null);
  const [bundleError, setBundleError] = useState<string | null>(null);

  const { data: bundle } = useBundle(bundleId);

  useEffect(() => {
    if (detail?.tags) {
      setSelectedTagIds(detail.tags.map((tag) => tag.id));
    }
  }, [detail]);

  const toggleTag = (tagId: number): void => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId)
        ? prev.filter((x) => x !== tagId)
        : [...prev, tagId],
    );
  };

  const handleSaveTags = async (): Promise<void> => {
    setTagError(null);
    try {
      await setTags.mutateAsync(selectedTagIds);
    } catch {
      setTagError('Could not update tags. Please try again.');
    }
  };

  const handleDownload = async (): Promise<void> => {
    setBundleError(null);
    try {
      const created = await createBundle.mutateAsync([clipId]);
      setBundleId(created.id);
    } catch {
      setBundleError('Could not prepare the download. Please try again.');
    }
  };

  if (clipQuery.isLoading) {
    return (
      <PageWrapper title="Clip">
        <div className="flex justify-center py-16">
          <Spinner size={32} />
        </div>
      </PageWrapper>
    );
  }

  if (clipQuery.isError || !detail) {
    return (
      <PageWrapper title="Clip">
        <EmptyState
          title="Clip not found"
          description="This clip could not be loaded. It may have been deleted."
        />
      </PageWrapper>
    );
  }

  const duration = Math.max(detail.end_seconds - detail.start_seconds, 0);
  const bundleBusy =
    bundle?.status === 'queued' || bundle?.status === 'rendering';

  return (
    <PageWrapper title={detail.title || `Clip #${detail.rank}`}>
      <div className="mb-6">
        <Link
          to="/library"
          className="text-sm font-semibold text-brand-700 hover:underline"
        >
          ← Back to library
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <GlassCard className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-900">Details</h2>
            <StatusBadge status={detail.status} />
          </div>
          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-slate-500">Duration</dt>
              <dd className="font-medium text-slate-800">
                {formatDuration(duration)}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Aspect ratio</dt>
              <dd className="font-medium text-slate-800">
                {detail.aspect_ratio}
              </dd>
            </div>
            {detail.project_title && (
              <div>
                <dt className="text-slate-500">Project</dt>
                <dd className="font-medium text-slate-800">
                  {detail.project_title}
                </dd>
              </div>
            )}
          </dl>

          <div className="flex flex-wrap items-center gap-3">
            <GradientButton
              type="button"
              onClick={handleDownload}
              isLoading={createBundle.isPending}
            >
              Download
            </GradientButton>
            {bundleId && bundle && (
              <span className="flex items-center gap-2 text-sm">
                <StatusBadge status={bundle.status} />
                {bundleBusy && <Spinner size={16} />}
              </span>
            )}
            {bundle?.status === 'ready' && bundle.download_url && (
              <a
                href={bundle.download_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-brand-500 to-accent-500 px-5 py-2.5 text-sm font-semibold text-white hover:shadow-lg"
              >
                <Download size={16} />
                Save file
              </a>
            )}
          </div>
          {bundleError && (
            <p className="text-sm text-red-600" role="alert">
              {bundleError}
            </p>
          )}
          {bundle?.status === 'failed' && (
            <p className="text-sm text-red-600">
              The download failed to build. Try again.
            </p>
          )}
        </GlassCard>

        <GlassCard className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-slate-900">Tags</h2>
          <p className="text-xs text-slate-500">
            Select every tag that applies — the full set is saved.
          </p>
          <div className="flex flex-wrap gap-2">
            {(allTags ?? []).map((tag) => {
              const active = selectedTagIds.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => toggleTag(tag.id)}
                  aria-pressed={active}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
                    active
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50',
                  )}
                >
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: tag.color }}
                  />
                  {tag.name}
                </button>
              );
            })}
            {(allTags?.length ?? 0) === 0 && (
              <p className="text-sm text-slate-500">
                No tags yet. Create tags from the library page.
              </p>
            )}
          </div>
          {tagError && (
            <p className="text-sm text-red-600" role="alert">
              {tagError}
            </p>
          )}
          <GradientButton
            type="button"
            onClick={handleSaveTags}
            isLoading={setTags.isPending}
            className="self-start"
          >
            Save tags
          </GradientButton>
        </GlassCard>
      </div>

      <div className="mt-6">
        <VersionHistoryList clipId={clipId} />
      </div>
    </PageWrapper>
  );
}

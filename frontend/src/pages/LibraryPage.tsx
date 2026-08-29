import { useMemo, useState } from 'react';
import { Download, Film } from 'lucide-react';
import { PageWrapper } from '../components/layout/PageWrapper';
import { GlassCard } from '../components/ui/GlassCard';
import { GradientButton } from '../components/ui/GradientButton';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Spinner } from '../components/ui/Spinner';
import { EmptyState } from '../components/ui/EmptyState';
import { FilterBar } from '../components/library/FilterBar';
import { TagFilter } from '../components/library/TagFilter';
import { ClipGrid } from '../components/library/ClipGrid';
import { useBundle, useCreateBundle, useLibraryClips } from '../hooks/useLibrary';
import type { LibraryFilters } from '../types/library';

const PER_PAGE = 24;

export default function LibraryPage() {
  const [filters, setFilters] = useState<LibraryFilters>({
    page: 1,
    per_page: PER_PAGE,
  });
  const [selectedTagId, setSelectedTagId] = useState<number | undefined>();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [bundleId, setBundleId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const effectiveFilters = useMemo<LibraryFilters>(
    () => ({ ...filters, tag_id: selectedTagId }),
    [filters, selectedTagId],
  );

  const { data, isLoading, isError } = useLibraryClips(effectiveFilters);
  const createBundle = useCreateBundle();
  const { data: bundle } = useBundle(bundleId);

  const page = data?.page ?? filters.page ?? 1;
  const totalPages = data
    ? Math.max(1, Math.ceil(data.total / Math.max(data.per_page, 1)))
    : 1;
  const clips = data?.items ?? [];

  const toggleSelect = (clipId: number): void => {
    setSelectedIds((prev) =>
      prev.includes(clipId)
        ? prev.filter((id) => id !== clipId)
        : [...prev, clipId],
    );
  };

  const goToPage = (next: number): void => {
    setFilters((prev) => ({ ...prev, page: next }));
  };

  const handleDownload = async (): Promise<void> => {
    setError(null);
    try {
      const created = await createBundle.mutateAsync(selectedIds);
      setBundleId(created.id);
    } catch {
      setError('Could not start the download bundle. Please try again.');
    }
  };

  const bundleBusy =
    bundle?.status === 'queued' || bundle?.status === 'rendering';

  return (
    <PageWrapper title="Library">
      <FilterBar value={filters} onChange={setFilters} />
      <TagFilter selectedId={selectedTagId} onSelect={setSelectedTagId} />

      <GlassCard className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-slate-600">
          {selectedIds.length > 0
            ? `${selectedIds.length} clip${selectedIds.length === 1 ? '' : 's'} selected`
            : 'Select clips to build a download bundle'}
        </div>
        <div className="flex flex-wrap items-center gap-3">
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
              Download bundle
            </a>
          )}
          <GradientButton
            type="button"
            onClick={handleDownload}
            isLoading={createBundle.isPending}
            disabled={selectedIds.length === 0}
          >
            Download selected
          </GradientButton>
        </div>
      </GlassCard>

      {error && (
        <p className="mb-4 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      {bundle?.status === 'failed' && (
        <p className="mb-4 text-sm text-red-600">
          The download bundle failed to build. Try again.
        </p>
      )}

      {isLoading && (
        <div className="flex justify-center py-16">
          <Spinner size={32} />
        </div>
      )}

      {isError && !isLoading && (
        <GlassCard>
          <p className="text-sm text-red-600">
            Could not load your library. Please try again.
          </p>
        </GlassCard>
      )}

      {!isLoading && !isError && clips.length === 0 && (
        <EmptyState
          icon={Film}
          title="No clips match these filters"
          description="Try clearing a filter or tag, or render some clips first."
        />
      )}

      {!isLoading && !isError && clips.length > 0 && (
        <>
          <ClipGrid
            clips={clips}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
          />

          <div className="mt-8 flex items-center justify-center gap-4">
            <button
              type="button"
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-sm text-slate-500">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </>
      )}
    </PageWrapper>
  );
}

import { motion } from 'framer-motion';
import { Captions, Pencil, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PageWrapper } from '../components/layout/PageWrapper';
import { GlassCard } from '../components/ui/GlassCard';
import { GradientButton } from '../components/ui/GradientButton';
import { Spinner } from '../components/ui/Spinner';
import { EmptyState } from '../components/ui/EmptyState';
import { Modal } from '../components/ui/Modal';
import { CaptionPresetForm } from '../components/brand/CaptionPresetForm';
import { LiveCaptionPreview } from '../components/brand/LiveCaptionPreview';
import { useBrandKits } from '../hooks/useBrandKits';
import {
  useCaptionPresets,
  useCreateCaptionPreset,
  useDeleteCaptionPreset,
  useUpdateCaptionPreset,
} from '../hooks/useCaptionPresets';
import type {
  CaptionStylePreset,
  CaptionStylePresetInput,
} from '../types/brand';

export default function CaptionPresetPage() {
  const brandKitsQuery = useBrandKits();
  const brandKits = useMemo(
    () => brandKitsQuery.data ?? [],
    [brandKitsQuery.data],
  );

  const [brandKitId, setBrandKitId] = useState<number | null>(null);

  useEffect(() => {
    if (brandKitId === null && brandKits.length > 0) {
      const preferred =
        brandKits.find((kit) => kit.is_default) ?? brandKits[0];
      setBrandKitId(preferred.id);
    }
  }, [brandKitId, brandKits]);

  const presetsQuery = useCaptionPresets(brandKitId ?? undefined);
  const createPreset = useCreateCaptionPreset();
  const updatePreset = useUpdateCaptionPreset();
  const deletePreset = useDeleteCaptionPreset();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<CaptionStylePreset | null>(null);
  const [pendingDelete, setPendingDelete] =
    useState<CaptionStylePreset | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const presets = presetsQuery.data ?? [];

  const openCreate = (): void => {
    setEditing(null);
    setIsFormOpen(true);
  };

  const openEdit = (preset: CaptionStylePreset): void => {
    setEditing(preset);
    setIsFormOpen(true);
  };

  const handleSubmit = async (
    input: CaptionStylePresetInput,
  ): Promise<void> => {
    if (editing) {
      await updatePreset.mutateAsync({ id: editing.id, input });
    } else {
      await createPreset.mutateAsync(input);
    }
    setIsFormOpen(false);
    setEditing(null);
  };

  const confirmDelete = async (): Promise<void> => {
    if (!pendingDelete) {
      return;
    }
    setActionError(null);
    try {
      await deletePreset.mutateAsync(pendingDelete.id);
      setPendingDelete(null);
    } catch {
      setActionError('Could not delete that preset. Please try again.');
    }
  };

  return (
    <PageWrapper>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Caption presets</h1>
          <p className="text-sm text-slate-500">
            Reusable caption styling tied to a brand kit.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/settings/brand"
            className="text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            ← Brand kits
          </Link>
          <GradientButton
            type="button"
            onClick={openCreate}
            disabled={brandKitId === null}
          >
            New preset
          </GradientButton>
        </div>
      </div>

      {brandKitsQuery.isLoading && (
        <div className="flex justify-center py-20">
          <Spinner size={32} />
        </div>
      )}

      {brandKitsQuery.isError && !brandKitsQuery.isLoading && (
        <EmptyState
          title="Could not load brand kits"
          description="Caption presets need a brand kit to attach to."
          action={
            <GradientButton
              type="button"
              onClick={() => void brandKitsQuery.refetch()}
            >
              Try again
            </GradientButton>
          }
        />
      )}

      {!brandKitsQuery.isLoading &&
        !brandKitsQuery.isError &&
        brandKits.length === 0 && (
          <EmptyState
            icon={Captions}
            title="No brand kits yet"
            description="Create a brand kit first, then add caption presets to it."
            action={
              <Link to="/settings/brand">
                <GradientButton type="button">Go to brand kits</GradientButton>
              </Link>
            }
          />
        )}

      {!brandKitsQuery.isLoading && brandKits.length > 0 && (
        <>
          <div className="mb-6 w-full max-w-xs">
            <label
              htmlFor="preset-brand-kit"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Brand kit
            </label>
            <select
              id="preset-brand-kit"
              value={brandKitId ?? ''}
              onChange={(event) => setBrandKitId(Number(event.target.value))}
              className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-brand-500"
            >
              {brandKits.map((kit) => (
                <option key={kit.id} value={kit.id}>
                  {kit.name}
                  {kit.is_default ? ' (default)' : ''}
                </option>
              ))}
            </select>
          </div>

          {presetsQuery.isLoading && (
            <div className="flex justify-center py-16">
              <Spinner size={28} />
            </div>
          )}

          {presetsQuery.isError && !presetsQuery.isLoading && (
            <EmptyState
              title="Could not load presets"
              description="Something went wrong while fetching caption presets."
              action={
                <GradientButton
                  type="button"
                  onClick={() => void presetsQuery.refetch()}
                >
                  Try again
                </GradientButton>
              }
            />
          )}

          {!presetsQuery.isLoading &&
            !presetsQuery.isError &&
            presets.length === 0 && (
              <EmptyState
                icon={Captions}
                title="No presets on this brand kit"
                description="Create a caption preset to reuse it across clips."
                action={
                  <GradientButton type="button" onClick={openCreate}>
                    New preset
                  </GradientButton>
                }
              />
            )}

          {!presetsQuery.isLoading &&
            !presetsQuery.isError &&
            presets.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {presets.map((preset) => (
                  <GlassCard key={preset.id} className="flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <h2 className="truncate text-lg font-semibold text-slate-900">
                        {preset.name}
                      </h2>
                    </div>

                    <LiveCaptionPreview
                      className="[&>div]:max-h-[220px] [&>div]:max-w-[150px]"
                      sampleText="Sample caption text"
                      values={{
                        font_family: preset.font_family,
                        font_size: preset.font_size,
                        text_color: preset.text_color,
                        highlight_color: preset.highlight_color,
                        background_style: preset.background_style,
                        animation: preset.animation,
                        position: preset.position,
                      }}
                    />

                    <div className="mt-auto flex flex-wrap gap-2 pt-2">
                      <motion.button
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        type="button"
                        onClick={() => openEdit(preset)}
                        className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                      >
                        <Pencil size={12} />
                        Edit
                      </motion.button>
                      <motion.button
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        type="button"
                        onClick={() => setPendingDelete(preset)}
                        className="inline-flex items-center gap-1 rounded-full border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                      >
                        <Trash2 size={12} />
                        Delete
                      </motion.button>
                    </div>
                  </GlassCard>
                ))}
              </div>
            )}
        </>
      )}

      <Modal
        isOpen={isFormOpen && brandKitId !== null}
        onClose={() => {
          setIsFormOpen(false);
          setEditing(null);
        }}
        title={editing ? 'Edit caption preset' : 'New caption preset'}
        className="max-w-3xl"
      >
        {brandKitId !== null && (
          <CaptionPresetForm
            brandKitId={brandKitId}
            initial={editing ?? undefined}
            isSubmitting={createPreset.isPending || updatePreset.isPending}
            onSubmit={handleSubmit}
            onCancel={() => {
              setIsFormOpen(false);
              setEditing(null);
            }}
          />
        )}
      </Modal>

      <Modal
        isOpen={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title="Delete caption preset"
        footer={
          <>
            <button
              type="button"
              onClick={() => setPendingDelete(null)}
              className="rounded-full px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <GradientButton
              type="button"
              onClick={() => void confirmDelete()}
              isLoading={deletePreset.isPending}
              className="bg-gradient-to-r from-red-500 to-rose-500"
            >
              Delete
            </GradientButton>
          </>
        }
      >
        <p>
          Delete <span className="font-semibold">{pendingDelete?.name}</span>?
          This cannot be undone.
        </p>
        {actionError && (
          <p className="mt-3 text-sm text-red-500">{actionError}</p>
        )}
      </Modal>
    </PageWrapper>
  );
}

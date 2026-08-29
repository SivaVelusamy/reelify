import { motion } from 'framer-motion';
import { Palette, Pencil, Star, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageWrapper } from '../components/layout/PageWrapper';
import { GlassCard } from '../components/ui/GlassCard';
import { GradientButton } from '../components/ui/GradientButton';
import { Spinner } from '../components/ui/Spinner';
import { EmptyState } from '../components/ui/EmptyState';
import { Modal } from '../components/ui/Modal';
import { BrandKitForm } from '../components/brand/BrandKitForm';
import { LogoUploader } from '../components/brand/LogoUploader';
import {
  useBrandKits,
  useCreateBrandKit,
  useDeleteBrandKit,
  useUpdateBrandKit,
} from '../hooks/useBrandKits';
import type { BrandKit, BrandKitInput } from '../types/brand';

export default function BrandKitPage() {
  const { data, isLoading, isError, refetch } = useBrandKits();
  const createBrandKit = useCreateBrandKit();
  const updateBrandKit = useUpdateBrandKit();
  const deleteBrandKit = useDeleteBrandKit();

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<BrandKit | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<BrandKit | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const brandKits = data ?? [];
  const selectedKit =
    brandKits.find((kit) => kit.id === selectedId) ?? null;

  const openCreate = (): void => {
    setEditing(null);
    setIsFormOpen(true);
  };

  const openEdit = (kit: BrandKit): void => {
    setEditing(kit);
    setIsFormOpen(true);
  };

  const handleSubmit = async (input: BrandKitInput): Promise<void> => {
    if (editing) {
      await updateBrandKit.mutateAsync({ id: editing.id, input });
    } else {
      const created = await createBrandKit.mutateAsync(input);
      setSelectedId(created.id);
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
      await deleteBrandKit.mutateAsync(pendingDelete.id);
      if (selectedId === pendingDelete.id) {
        setSelectedId(null);
      }
      setPendingDelete(null);
    } catch {
      setActionError('Could not delete that brand kit. Please try again.');
    }
  };

  return (
    <PageWrapper>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Brand kits</h1>
          <p className="text-sm text-slate-500">
            Colors, fonts and watermark placement applied to your clips.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/settings/brand/presets"
            className="text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            Caption presets →
          </Link>
          <GradientButton type="button" onClick={openCreate}>
            New brand kit
          </GradientButton>
        </div>
      </div>

      {isLoading && (
        <div className="flex justify-center py-20">
          <Spinner size={32} />
        </div>
      )}

      {isError && !isLoading && (
        <EmptyState
          title="Could not load brand kits"
          description="Something went wrong while fetching your brand kits."
          action={
            <GradientButton type="button" onClick={() => void refetch()}>
              Try again
            </GradientButton>
          }
        />
      )}

      {!isLoading && !isError && brandKits.length === 0 && (
        <EmptyState
          icon={Palette}
          title="No brand kits yet"
          description="Create a brand kit to keep every clip on-brand."
          action={
            <GradientButton type="button" onClick={openCreate}>
              New brand kit
            </GradientButton>
          }
        />
      )}

      {!isLoading && !isError && brandKits.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {brandKits.map((kit) => (
            <GlassCard key={kit.id} className="flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate text-lg font-semibold text-slate-900">
                      {kit.name}
                    </h2>
                    {kit.is_default && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                        <Star size={12} />
                        Default
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {kit.font_family ?? 'System font'} ·{' '}
                    {kit.watermark_position ?? 'no watermark'}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <span
                  className="h-8 w-8 rounded-lg border border-white/60"
                  style={{ backgroundColor: kit.primary_color ?? '#E2E8F0' }}
                  title={kit.primary_color ?? undefined}
                />
                <span
                  className="h-8 w-8 rounded-lg border border-white/60"
                  style={{ backgroundColor: kit.secondary_color ?? '#E2E8F0' }}
                  title={kit.secondary_color ?? undefined}
                />
                {kit.logo_url && (
                  <img
                    src={kit.logo_url}
                    alt=""
                    className="h-8 w-auto rounded-lg bg-white object-contain px-1"
                  />
                )}
              </div>

              <div className="mt-auto flex flex-wrap gap-2 pt-2">
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  type="button"
                  onClick={() =>
                    setSelectedId((current) =>
                      current === kit.id ? null : kit.id,
                    )
                  }
                  className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  {selectedId === kit.id ? 'Hide logo' : 'Logo'}
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  type="button"
                  onClick={() => openEdit(kit)}
                  className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                >
                  <Pencil size={12} />
                  Edit
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  type="button"
                  onClick={() => setPendingDelete(kit)}
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

      {selectedKit && (
        <div className="mt-6">
          <GlassCard>
            <h3 className="mb-1 text-lg font-semibold text-slate-900">
              Logo / watermark — {selectedKit.name}
            </h3>
            <p className="mb-4 text-sm text-slate-500">
              Placed {selectedKit.watermark_position ?? 'bottom-right'} on
              rendered clips.
            </p>
            <LogoUploader
              brandKitId={selectedKit.id}
              currentLogoUrl={selectedKit.logo_url}
            />
          </GlassCard>
        </div>
      )}

      <Modal
        isOpen={isFormOpen}
        onClose={() => {
          setIsFormOpen(false);
          setEditing(null);
        }}
        title={editing ? 'Edit brand kit' : 'New brand kit'}
      >
        <BrandKitForm
          initial={editing ?? undefined}
          isSubmitting={createBrandKit.isPending || updateBrandKit.isPending}
          onSubmit={handleSubmit}
          onCancel={() => {
            setIsFormOpen(false);
            setEditing(null);
          }}
        />
      </Modal>

      <Modal
        isOpen={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title="Delete brand kit"
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
              isLoading={deleteBrandKit.isPending}
              className="bg-gradient-to-r from-red-500 to-rose-500"
            >
              Delete
            </GradientButton>
          </>
        }
      >
        <p>
          Delete <span className="font-semibold">{pendingDelete?.name}</span>?
          Caption presets that reference it will lose their brand link. This
          cannot be undone.
        </p>
        {actionError && (
          <p className="mt-3 text-sm text-red-500">{actionError}</p>
        )}
      </Modal>
    </PageWrapper>
  );
}

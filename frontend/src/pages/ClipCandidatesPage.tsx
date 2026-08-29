import { useMemo, useState, type FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { Film } from 'lucide-react';
import { PageWrapper } from '../components/layout/PageWrapper';
import { GlassCard } from '../components/ui/GlassCard';
import { GradientButton } from '../components/ui/GradientButton';
import { AnimatedInput } from '../components/ui/AnimatedInput';
import { AnimatedList } from '../components/ui/AnimatedList';
import { EmptyState } from '../components/ui/EmptyState';
import { Spinner } from '../components/ui/Spinner';
import { Modal } from '../components/ui/Modal';
import { ClipCard } from '../components/clips/ClipCard';
import { useClipCandidates, useCreateManualClip } from '../hooks/useClips';

export default function ClipCandidatesPage() {
  const { id } = useParams<{ id: string }>();
  const videoId = Number(id);

  const { data: clips, isLoading, isError } = useClipCandidates(videoId);
  const createClip = useCreateManualClip(videoId);

  const [modalOpen, setModalOpen] = useState(false);
  const [start, setStart] = useState('0');
  const [end, setEnd] = useState('30');
  const [title, setTitle] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  const sorted = useMemo(
    () => [...(clips ?? [])].sort((a, b) => a.rank - b.rank),
    [clips],
  );

  const closeModal = (): void => {
    setModalOpen(false);
    setFormError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setFormError(null);
    const startSeconds = Number(start);
    const endSeconds = Number(end);
    if (!Number.isFinite(startSeconds) || !Number.isFinite(endSeconds)) {
      setFormError('Start and end must be numbers.');
      return;
    }
    if (endSeconds <= startSeconds) {
      setFormError('End must be after start.');
      return;
    }
    try {
      await createClip.mutateAsync({
        start_seconds: startSeconds,
        end_seconds: endSeconds,
        title: title.trim() || undefined,
      });
      closeModal();
      setTitle('');
    } catch {
      setFormError('Could not create the clip. Please try again.');
    }
  };

  return (
    <PageWrapper title="Clip candidates">
      <div className="mb-6 flex justify-end">
        <GradientButton type="button" onClick={() => setModalOpen(true)}>
          New manual clip
        </GradientButton>
      </div>

      {isLoading && (
        <div className="flex justify-center py-16">
          <Spinner size={32} />
        </div>
      )}

      {isError && !isLoading && (
        <GlassCard>
          <p className="text-sm text-red-600">
            Could not load clip candidates for this video.
          </p>
        </GlassCard>
      )}

      {!isLoading && !isError && sorted.length === 0 && (
        <EmptyState
          icon={Film}
          title="No clips yet"
          description="This video has no clip candidates. Create one manually to get started."
          action={
            <GradientButton type="button" onClick={() => setModalOpen(true)}>
              New manual clip
            </GradientButton>
          }
        />
      )}

      {!isLoading && !isError && sorted.length > 0 && (
        <AnimatedList>
          {sorted.map((clip) => (
            <ClipCard key={clip.id} clip={clip} />
          ))}
        </AnimatedList>
      )}

      <Modal isOpen={modalOpen} onClose={closeModal} title="New manual clip">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex gap-3">
            <AnimatedInput
              id="clip-start"
              label="Start (seconds)"
              type="number"
              min={0}
              step={0.1}
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
            <AnimatedInput
              id="clip-end"
              label="End (seconds)"
              type="number"
              min={0}
              step={0.1}
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
          </div>
          <AnimatedInput
            id="clip-title"
            label="Title (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          {formError && <p className="text-sm text-red-600">{formError}</p>}
          <div className="mt-2 flex justify-end gap-3">
            <button
              type="button"
              onClick={closeModal}
              className="rounded-full px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <GradientButton type="submit" isLoading={createClip.isPending}>
              Create clip
            </GradientButton>
          </div>
        </form>
      </Modal>
    </PageWrapper>
  );
}

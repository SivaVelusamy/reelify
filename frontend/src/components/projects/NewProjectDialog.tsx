import { useState, type FormEvent } from 'react';
import { Modal } from '../ui/Modal';
import { AnimatedInput } from '../ui/AnimatedInput';
import { GradientButton } from '../ui/GradientButton';
import { useCreateProject } from '../../hooks/useProjects';
import type { Project } from '../../types';

interface NewProjectDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated?: (project: Project) => void;
}

export function NewProjectDialog({
  isOpen,
  onClose,
  onCreated,
}: NewProjectDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [campaign, setCampaign] = useState('');
  const [error, setError] = useState<string | null>(null);
  const createProject = useCreateProject();

  const reset = (): void => {
    setTitle('');
    setDescription('');
    setCampaign('');
    setError(null);
  };

  const handleClose = (): void => {
    reset();
    onClose();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError('A project title is required.');
      return;
    }

    try {
      const project = await createProject.mutateAsync({
        title: title.trim(),
        description: description.trim() || null,
        campaign: campaign.trim() || null,
      });
      reset();
      onCreated?.(project);
      onClose();
    } catch {
      setError('Could not create the project. Please try again.');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="New project">
      <form onSubmit={handleSubmit} className="space-y-4">
        <AnimatedInput
          id="project-title"
          label="Title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Q3 All-Hands"
          autoFocus
        />
        <div className="w-full">
          <label
            htmlFor="project-description"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            Description
          </label>
          <textarea
            id="project-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            placeholder="What is this project about?"
            className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 outline-none transition-colors focus:border-brand-500"
          />
        </div>
        <AnimatedInput
          id="project-campaign"
          label="Campaign"
          value={campaign}
          onChange={(event) => setCampaign(event.target.value)}
          placeholder="Internal Comms"
        />

        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-full px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Cancel
          </button>
          <GradientButton type="submit" isLoading={createProject.isPending}>
            Create project
          </GradientButton>
        </div>
      </form>
    </Modal>
  );
}

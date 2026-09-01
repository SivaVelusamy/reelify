import { useState, type MouseEvent } from 'react';
import { Film, Megaphone, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useDeleteProject } from '../../hooks/useProjects';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { GlassCard } from '../ui/GlassCard';
import { formatRelative } from '../../lib/utils';
import type { Project } from '../../types';

interface ProjectCardProps {
  project: Project;
  videoCount?: number;
}

export function ProjectCard({ project, videoCount }: ProjectCardProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const deleteProject = useDeleteProject();

  const openConfirm = (event: MouseEvent): void => {
    event.preventDefault();
    event.stopPropagation();
    setConfirmOpen(true);
  };

  return (
    <div className="relative">
      <Link to={`/projects/${project.id}`} className="block">
        <GlassCard className="h-full">
          <div className="flex items-start justify-between gap-3 pr-8">
            <h3 className="text-lg font-semibold text-slate-900">
              {project.title}
            </h3>
            {typeof videoCount === 'number' && (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-medium text-brand-700">
                <Film size={14} />
                {videoCount}
              </span>
            )}
          </div>

          {project.description && (
            <p className="mt-2 line-clamp-2 text-sm text-slate-600">
              {project.description}
            </p>
          )}

          <div className="mt-4 flex items-center justify-between text-xs text-slate-500">
            {project.campaign ? (
              <span className="inline-flex items-center gap-1">
                <Megaphone size={14} />
                {project.campaign}
              </span>
            ) : (
              <span />
            )}
            <span>
              {project.updated_at
                ? `Updated ${formatRelative(project.updated_at)}`
                : `Created ${formatRelative(project.created_at)}`}
            </span>
          </div>
        </GlassCard>
      </Link>

      <button
        type="button"
        onClick={openConfirm}
        aria-label={`Delete project ${project.title}`}
        className="absolute right-3 top-3 rounded-full p-1.5 text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
      >
        <Trash2 size={15} />
      </button>

      <ConfirmDialog
        isOpen={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => deleteProject.mutateAsync(project.id)}
        title="Delete this project?"
        body={`“${project.title}” and all of its source videos and clips will be permanently deleted. This cannot be undone.`}
        confirmLabel="Delete project"
      />
    </div>
  );
}

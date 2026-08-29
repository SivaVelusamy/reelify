import { Film, Megaphone } from 'lucide-react';
import { Link } from 'react-router-dom';
import { GlassCard } from '../ui/GlassCard';
import { formatRelative } from '../../lib/utils';
import type { Project } from '../../types';

interface ProjectCardProps {
  project: Project;
  videoCount?: number;
}

export function ProjectCard({ project, videoCount }: ProjectCardProps) {
  return (
    <Link to={`/projects/${project.id}`} className="block">
      <GlassCard className="h-full">
        <div className="flex items-start justify-between gap-3">
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
          <span>Updated {formatRelative(project.updated_at)}</span>
        </div>
      </GlassCard>
    </Link>
  );
}

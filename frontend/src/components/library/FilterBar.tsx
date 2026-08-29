import { FolderOpen } from 'lucide-react';
import { useProjects } from '../../hooks/useProjects';
import type { ClipStatus } from '../../types';
import type { LibraryFilters } from '../../types/library';
import { GlassCard } from '../ui/GlassCard';

const STATUS_OPTIONS: ClipStatus[] = [
  'suggested',
  'draft',
  'rendered',
  'archived',
];

const SELECT_CLASS =
  'w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition-colors focus:border-brand-500';

interface FilterBarProps {
  value: LibraryFilters;
  onChange: (next: LibraryFilters) => void;
}

/**
 * Project + campaign + status filters. Tag filtering is handled separately by
 * <TagFilter /> because the backend accepts a single tag_id.
 */
export function FilterBar({ value, onChange }: FilterBarProps) {
  const { data: projects } = useProjects();

  const patch = (partial: Partial<LibraryFilters>): void => {
    onChange({ ...value, ...partial, page: 1 });
  };

  return (
    <GlassCard className="mb-6">
      <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-700">
        <FolderOpen size={16} />
        Filters
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
          Project
          <select
            className={SELECT_CLASS}
            value={value.project_id ?? ''}
            onChange={(e) =>
              patch({
                project_id: e.target.value ? Number(e.target.value) : undefined,
              })
            }
          >
            <option value="">All projects</option>
            {projects?.map((project) => (
              <option key={project.id} value={project.id}>
                {project.title}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
          Campaign
          <input
            type="text"
            className={SELECT_CLASS}
            placeholder="Any campaign"
            value={value.campaign ?? ''}
            onChange={(e) =>
              patch({ campaign: e.target.value || undefined })
            }
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium text-slate-700">
          Status
          <select
            className={SELECT_CLASS}
            value={value.status ?? ''}
            onChange={(e) =>
              patch({
                status: e.target.value
                  ? (e.target.value as ClipStatus)
                  : undefined,
              })
            }
          >
            <option value="">Any status</option>
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
      </div>
    </GlassCard>
  );
}

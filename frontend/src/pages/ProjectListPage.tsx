import { FolderPlus } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageWrapper } from '../components/layout/PageWrapper';
import { AnimatedList } from '../components/ui/AnimatedList';
import { EmptyState } from '../components/ui/EmptyState';
import { GradientButton } from '../components/ui/GradientButton';
import { Spinner } from '../components/ui/Spinner';
import { ProjectCard } from '../components/projects/ProjectCard';
import { NewProjectDialog } from '../components/projects/NewProjectDialog';
import { useProjects } from '../hooks/useProjects';
import type { Project } from '../types';

export default function ProjectListPage() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useProjects();

  const handleCreated = (project: Project): void => {
    navigate(`/projects/${project.id}`);
  };

  const projects = data ?? [];

  return (
    <PageWrapper>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Projects</h1>
          <p className="text-sm text-slate-500">
            Group your source videos and clips by campaign.
          </p>
        </div>
        <GradientButton type="button" onClick={() => setIsDialogOpen(true)}>
          New project
        </GradientButton>
      </div>

      {isLoading && (
        <div className="flex justify-center py-20">
          <Spinner size={32} />
        </div>
      )}

      {isError && !isLoading && (
        <EmptyState
          title="Could not load projects"
          description="Something went wrong while fetching your projects."
          action={
            <GradientButton type="button" onClick={() => void refetch()}>
              Try again
            </GradientButton>
          }
        />
      )}

      {!isLoading && !isError && projects.length === 0 && (
        <EmptyState
          icon={FolderPlus}
          title="No projects yet"
          description="Create your first project to start uploading videos."
          action={
            <GradientButton type="button" onClick={() => setIsDialogOpen(true)}>
              New project
            </GradientButton>
          }
        />
      )}

      {!isLoading && !isError && projects.length > 0 && (
        <AnimatedList className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))}
        </AnimatedList>
      )}

      <NewProjectDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onCreated={handleCreated}
      />
    </PageWrapper>
  );
}

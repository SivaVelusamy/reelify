import { ArrowLeft, Film, Megaphone } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { PageWrapper } from '../components/layout/PageWrapper';
import { GlassCard } from '../components/ui/GlassCard';
import { GradientButton } from '../components/ui/GradientButton';
import { EmptyState } from '../components/ui/EmptyState';
import { Spinner } from '../components/ui/Spinner';
import { StatusBadge } from '../components/ui/StatusBadge';
import { useProject, useProjectVideos } from '../hooks/useProjects';
import { formatDate, formatDuration, formatRelative } from '../lib/utils';
import type { SourceVideo } from '../types';

function VideoRow({ video }: { video: SourceVideo }) {
  const label = video.filename || video.original_url || `Video #${video.id}`;
  return (
    <Link
      to={`/videos/${video.id}`}
      className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3 transition-colors hover:border-brand-300 hover:bg-brand-50/40"
    >
      <span className="flex min-w-0 items-center gap-3">
        <Film size={18} className="shrink-0 text-brand-600" />
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-slate-800">
            {label}
          </span>
          <span className="block text-xs text-slate-500">
            {video.source_type === 'youtube_url' ? 'YouTube import' : 'Upload'}
            {video.duration_seconds
              ? ` · ${formatDuration(video.duration_seconds)}`
              : ''}
            {` · added ${formatRelative(video.created_at)}`}
          </span>
        </span>
      </span>
      <StatusBadge status={video.status} />
    </Link>
  );
}

export default function ProjectDetailPage() {
  const params = useParams();
  const id = Number(params.id);
  const projectId = Number.isFinite(id) ? id : undefined;
  const { data: project, isLoading, isError, refetch } = useProject(projectId);
  const { data: projectVideos } = useProjectVideos(projectId);

  if (isLoading) {
    return (
      <PageWrapper>
        <div className="flex justify-center py-20">
          <Spinner size={32} />
        </div>
      </PageWrapper>
    );
  }

  if (isError || !project) {
    return (
      <PageWrapper>
        <EmptyState
          title="Could not load this project"
          description="It may have been deleted, or something went wrong."
          action={
            <GradientButton type="button" onClick={() => void refetch()}>
              Try again
            </GradientButton>
          }
        />
      </PageWrapper>
    );
  }

  const videos = projectVideos ?? project.videos ?? [];

  return (
    <PageWrapper>
      <Link
        to="/projects"
        className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft size={16} />
        All projects
      </Link>

      <GlassCard className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {project.title}
            </h1>
            {project.description && (
              <p className="mt-1 max-w-2xl text-sm text-slate-600">
                {project.description}
              </p>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-500">
              {project.campaign && (
                <span className="inline-flex items-center gap-1">
                  <Megaphone size={14} />
                  {project.campaign}
                </span>
              )}
              <span>Created {formatDate(project.created_at)}</span>
            </div>
          </div>
          <Link to={`/projects/${project.id}/upload`}>
            <GradientButton type="button">Upload</GradientButton>
          </Link>
        </div>
      </GlassCard>

      <h2 className="mb-3 text-lg font-semibold text-slate-900">
        Source videos
      </h2>

      {videos.length === 0 ? (
        <EmptyState
          icon={Film}
          title="No videos yet"
          description="Upload a file or import a YouTube URL to start the pipeline."
          action={
            <Link to={`/projects/${project.id}/upload`}>
              <GradientButton type="button">Upload a video</GradientButton>
            </Link>
          }
        />
      ) : (
        <div className="space-y-2">
          {videos.map((video) => (
            <VideoRow key={video.id} video={video} />
          ))}
        </div>
      )}
    </PageWrapper>
  );
}

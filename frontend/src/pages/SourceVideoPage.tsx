import { ArrowLeft, Clapperboard } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { PageWrapper } from '../components/layout/PageWrapper';
import { GlassCard } from '../components/ui/GlassCard';
import { GradientButton } from '../components/ui/GradientButton';
import { EmptyState } from '../components/ui/EmptyState';
import { Spinner } from '../components/ui/Spinner';
import { StatusBadge } from '../components/ui/StatusBadge';
import { StatusTracker } from '../components/projects/StatusTracker';
import { TranscriptPreview } from '../components/projects/TranscriptPreview';
import {
  useSourceVideo,
  useTranscript,
  useVideoStatus,
} from '../hooks/useSourceVideo';
import { formatDate, formatDuration } from '../lib/utils';

export default function SourceVideoPage() {
  const params = useParams();
  const id = Number(params.id);
  const videoId = Number.isFinite(id) ? id : undefined;

  const { data: video, isLoading, isError, refetch } = useSourceVideo(videoId);
  const { data: statusData } = useVideoStatus(videoId);

  const status = statusData?.status ?? video?.status;
  const errorMessage = statusData?.error_message ?? video?.error_message ?? null;
  const isReady = status === 'ready';

  const {
    data: transcript,
    isLoading: transcriptLoading,
    isError: transcriptError,
  } = useTranscript(videoId, isReady);

  if (isLoading) {
    return (
      <PageWrapper>
        <div className="flex justify-center py-20">
          <Spinner size={32} />
        </div>
      </PageWrapper>
    );
  }

  if (isError || !video || !status) {
    return (
      <PageWrapper>
        <EmptyState
          title="Could not load this video"
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

  const title = video.filename || video.original_url || `Video #${video.id}`;

  return (
    <PageWrapper>
      <Link
        to={`/projects/${video.project_id}`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft size={16} />
        Back to project
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="max-w-2xl break-words text-2xl font-bold text-slate-900">
            {title}
          </h1>
          <div className="mt-2">
            <StatusBadge status={status} />
          </div>
        </div>
        {isReady && (
          <Link to={`/videos/${video.id}/clips`}>
            <GradientButton type="button">
              <span className="inline-flex items-center gap-2">
                <Clapperboard size={16} />
                View clips
              </span>
            </GradientButton>
          </Link>
        )}
      </div>

      <div className="mb-6">
        <StatusTracker
          videoId={video.id}
          status={status}
          errorMessage={errorMessage}
        />
      </div>

      <GlassCard className="mb-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Metadata
        </h2>
        <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-slate-500">Source</dt>
            <dd className="font-medium text-slate-800">
              {video.source_type === 'youtube_url' ? 'YouTube' : 'Upload'}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Duration</dt>
            <dd className="font-medium text-slate-800">
              {video.duration_seconds
                ? formatDuration(video.duration_seconds)
                : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Language</dt>
            <dd className="font-medium text-slate-800">
              {video.language ?? '—'}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Added</dt>
            <dd className="font-medium text-slate-800">
              {formatDate(video.created_at)}
            </dd>
          </div>
        </dl>
      </GlassCard>

      {isReady && (
        <div>
          <h2 className="mb-3 text-lg font-semibold text-slate-900">
            Transcript
          </h2>
          {transcriptLoading && (
            <div className="flex justify-center py-10">
              <Spinner size={24} />
            </div>
          )}
          {transcriptError && !transcriptLoading && (
            <p className="text-sm text-red-500">
              Could not load the transcript.
            </p>
          )}
          {transcript && !transcriptLoading && (
            <TranscriptPreview transcript={transcript} />
          )}
        </div>
      )}
    </PageWrapper>
  );
}

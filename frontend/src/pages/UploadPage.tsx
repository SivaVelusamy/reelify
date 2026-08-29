import { ArrowLeft, FileVideo, Plus, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { PageWrapper } from '../components/layout/PageWrapper';
import { GlassCard } from '../components/ui/GlassCard';
import { GradientButton } from '../components/ui/GradientButton';
import { FileDropzone } from '../components/projects/FileDropzone';
import { UrlImportForm } from '../components/projects/UrlImportForm';
import {
  useBatchUpload,
  useImportYouTube,
  useUploadVideo,
} from '../hooks/useSourceVideo';
import { formatBytes, cn } from '../lib/utils';
import type { PendingUploadFile } from '../types/projects';

const MAX_BYTES = 2 * 1024 * 1024 * 1024;

type TabKey = 'single' | 'url' | 'batch';

const TABS: readonly { key: TabKey; label: string }[] = [
  { key: 'single', label: 'Single upload' },
  { key: 'url', label: 'YouTube URL' },
  { key: 'batch', label: 'Batch' },
];

export default function UploadPage() {
  const params = useParams();
  const projectId = Number(params.id);
  const navigate = useNavigate();

  const [tab, setTab] = useState<TabKey>('single');
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState<PendingUploadFile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const batchInputRef = useRef<HTMLInputElement>(null);

  const uploadVideo = useUploadVideo(projectId);
  const importYouTube = useImportYouTube(projectId);
  const batchUpload = useBatchUpload(projectId);

  const backToProject = (): void => {
    navigate(`/projects/${projectId}`);
  };

  const handleSingleUpload = async (): Promise<void> => {
    if (!file) {
      return;
    }
    setError(null);
    try {
      const video = await uploadVideo.mutateAsync(file);
      navigate(`/videos/${video.id}`);
    } catch {
      setError('The upload failed. Please try again.');
    }
  };

  const handleUrlImport = async (url: string): Promise<void> => {
    setError(null);
    try {
      const video = await importYouTube.mutateAsync(url);
      navigate(`/videos/${video.id}`);
    } catch {
      setError('Could not import that video. Please try again.');
    }
  };

  const addBatchFiles = (fileList: FileList | null): void => {
    if (!fileList) {
      return;
    }
    const next: PendingUploadFile[] = Array.from(fileList).map((candidate) => ({
      id: `${candidate.name}-${candidate.size}-${candidate.lastModified}`,
      file: candidate,
      error: !candidate.type.startsWith('video/')
        ? 'Not a video file'
        : candidate.size > MAX_BYTES
          ? 'Over 2 GB'
          : null,
    }));
    setPending((current) => {
      const seen = new Set(current.map((item) => item.id));
      return [...current, ...next.filter((item) => !seen.has(item.id))];
    });
  };

  const removeBatchFile = (id: string): void => {
    setPending((current) => current.filter((item) => item.id !== id));
  };

  const handleBatchUpload = async (): Promise<void> => {
    const valid = pending.filter((item) => item.error === null);
    if (valid.length === 0) {
      setError('Add at least one valid video file.');
      return;
    }
    setError(null);
    try {
      await batchUpload.mutateAsync(valid.map((item) => item.file));
      backToProject();
    } catch {
      setError('The batch upload failed. Please try again.');
    }
  };

  return (
    <PageWrapper>
      <Link
        to={`/projects/${projectId}`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft size={16} />
        Back to project
      </Link>

      <h1 className="mb-6 text-2xl font-bold text-slate-900">Add a video</h1>

      <div className="mb-6 flex gap-2 rounded-full bg-slate-100 p-1">
        {TABS.map((entry) => (
          <button
            key={entry.key}
            type="button"
            onClick={() => {
              setTab(entry.key);
              setError(null);
            }}
            className={cn(
              'flex-1 rounded-full px-4 py-2 text-sm font-medium transition-colors',
              tab === entry.key
                ? 'bg-white text-brand-600 shadow'
                : 'text-slate-500 hover:text-slate-700',
            )}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <GlassCard>
        {error && <p className="mb-4 text-sm text-red-500">{error}</p>}

        {tab === 'single' && (
          <div className="space-y-4">
            <FileDropzone
              file={file}
              onFileSelected={setFile}
              disabled={uploadVideo.isPending}
            />
            <GradientButton
              type="button"
              onClick={handleSingleUpload}
              isLoading={uploadVideo.isPending}
              disabled={!file}
            >
              Start processing
            </GradientButton>
          </div>
        )}

        {tab === 'url' && (
          <UrlImportForm
            onSubmit={handleUrlImport}
            isLoading={importYouTube.isPending}
          />
        )}

        {tab === 'batch' && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={() => batchInputRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-white/60 px-4 py-6 text-sm font-medium text-slate-600 hover:border-brand-400"
            >
              <Plus size={18} />
              Add video files
            </button>
            <input
              ref={batchInputRef}
              type="file"
              accept="video/*"
              multiple
              className="hidden"
              onChange={(event) => {
                addBatchFiles(event.target.files);
                event.target.value = '';
              }}
            />

            {pending.length > 0 && (
              <ul className="space-y-2">
                {pending.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <FileVideo
                        size={16}
                        className="shrink-0 text-brand-600"
                      />
                      <span className="truncate text-sm text-slate-700">
                        {item.file.name}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-3 text-xs">
                      {item.error ? (
                        <span className="text-red-500">{item.error}</span>
                      ) : (
                        <span className="text-slate-500">
                          {formatBytes(item.file.size)}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => removeBatchFile(item.id)}
                        aria-label="Remove file"
                        className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                      >
                        <X size={14} />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}

            <GradientButton
              type="button"
              onClick={handleBatchUpload}
              isLoading={batchUpload.isPending}
              disabled={pending.length === 0}
            >
              Upload {pending.filter((item) => item.error === null).length} videos
            </GradientButton>
          </div>
        )}
      </GlassCard>
    </PageWrapper>
  );
}

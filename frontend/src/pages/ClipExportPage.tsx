import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Download } from 'lucide-react';
import { PageWrapper } from '../components/layout/PageWrapper';
import { GlassCard } from '../components/ui/GlassCard';
import { GradientButton } from '../components/ui/GradientButton';
import { AnimatedInput } from '../components/ui/AnimatedInput';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Spinner } from '../components/ui/Spinner';
import { useCreateExport, useExport } from '../hooks/useClips';
import { EXPORT_PRESETS } from '../types/clips';
import type { ClipExportPreset } from '../types';
import { cn } from '../lib/utils';

export default function ClipExportPage() {
  const { id } = useParams<{ id: string }>();
  const clipId = Number(id);

  const [preset, setPreset] = useState<ClipExportPreset>('shorts');
  const [resolution, setResolution] = useState('1080x1920');
  const [format, setFormat] = useState('mp4');
  const [exportId, setExportId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const createExport = useCreateExport(clipId);
  const { data: job } = useExport(exportId);

  const isCustom = preset === 'custom';

  const selectPreset = (value: ClipExportPreset): void => {
    setPreset(value);
    const match = EXPORT_PRESETS.find((option) => option.value === value);
    if (match && value !== 'custom') {
      setResolution(match.defaultResolution);
    }
  };

  const handleExport = async (): Promise<void> => {
    setError(null);
    try {
      const created = await createExport.mutateAsync({
        preset,
        resolution: resolution || undefined,
        format: format || undefined,
      });
      setExportId(created.id);
    } catch {
      setError('Could not start the export. Please try again.');
    }
  };

  const status = job?.status;
  const isBusy = status === 'queued' || status === 'rendering';
  const isReady = status === 'ready';
  const downloadUrl = job?.download_url ?? null;

  return (
    <PageWrapper title="Export clip">
      <div className="mb-6">
        <Link
          to={`/clips/${clipId}/edit`}
          className="text-sm font-semibold text-brand-700 hover:underline"
        >
          ← Back to editor
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <GlassCard className="flex flex-col gap-5">
          <div>
            <span className="mb-2 block text-sm font-medium text-slate-700">
              Preset
            </span>
            <div className="flex flex-wrap gap-2">
              {EXPORT_PRESETS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => selectPreset(option.value)}
                  aria-pressed={preset === option.value}
                  className={cn(
                    'rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors',
                    preset === option.value
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-slate-200 text-slate-600 hover:bg-slate-50',
                  )}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          <AnimatedInput
            id="export-resolution"
            label="Resolution"
            value={resolution}
            disabled={!isCustom}
            onChange={(e) => setResolution(e.target.value)}
          />

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="export-format"
              className="text-sm font-medium text-slate-700"
            >
              Format
            </label>
            <select
              id="export-format"
              value={format}
              onChange={(e) => setFormat(e.target.value)}
              className="rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
            >
              <option value="mp4">MP4</option>
              <option value="mov">MOV</option>
              <option value="webm">WebM</option>
            </select>
          </div>

          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}

          <GradientButton
            type="button"
            onClick={handleExport}
            isLoading={createExport.isPending}
          >
            Export
          </GradientButton>
        </GlassCard>

        <GlassCard className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-slate-900">Progress</h2>

          {!exportId && (
            <p className="text-sm text-slate-500">
              Choose a preset and start an export to see progress here.
            </p>
          )}

          {exportId && (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <StatusBadge status={status ?? 'queued'} />
                {isBusy && <Spinner size={18} />}
              </div>

              {isBusy && (
                <p className="text-sm text-slate-500">
                  Rendering your export — this page updates automatically.
                </p>
              )}

              {status === 'failed' && (
                <p className="text-sm text-red-600">
                  The export failed. Try again or adjust the preset.
                </p>
              )}

              {isReady && downloadUrl && (
                <a
                  href={downloadUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 self-start rounded-full bg-gradient-to-r from-brand-500 to-accent-500 px-6 py-3 text-sm font-semibold text-white hover:shadow-lg"
                >
                  <Download size={16} />
                  Download
                </a>
              )}

              {isReady && !downloadUrl && (
                <p className="text-sm text-slate-500">
                  Export is ready — the download link will appear shortly.
                </p>
              )}
            </div>
          )}
        </GlassCard>
      </div>
    </PageWrapper>
  );
}

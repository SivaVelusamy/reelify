import { useState } from 'react';
import { History, RotateCcw } from 'lucide-react';
import { useClipVersions, useRestoreVersion } from '../../hooks/useLibrary';
import { formatDate, formatRelative } from '../../lib/utils';
import { GlassCard } from '../ui/GlassCard';
import { GradientButton } from '../ui/GradientButton';
import { Modal } from '../ui/Modal';
import { Spinner } from '../ui/Spinner';

interface VersionHistoryListProps {
  clipId: number;
}

export function VersionHistoryList({ clipId }: VersionHistoryListProps) {
  const { data: versions, isLoading, isError } = useClipVersions(clipId);
  const restore = useRestoreVersion(clipId);

  const [confirmVersion, setConfirmVersion] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRestore = async (): Promise<void> => {
    if (confirmVersion === null) {
      return;
    }
    setError(null);
    try {
      await restore.mutateAsync(confirmVersion);
      setConfirmVersion(null);
    } catch {
      setError('Could not restore this version. Please try again.');
    }
  };

  return (
    <GlassCard className="flex flex-col gap-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        <History size={16} />
        Version history
      </div>

      {isLoading && (
        <div className="flex justify-center py-6">
          <Spinner size={22} />
        </div>
      )}

      {isError && !isLoading && (
        <p className="text-sm text-red-600">Could not load version history.</p>
      )}

      {!isLoading && !isError && (versions?.length ?? 0) === 0 && (
        <p className="text-sm text-slate-500">No previous versions yet.</p>
      )}

      {!isLoading && !isError && (versions?.length ?? 0) > 0 && (
        <ul className="flex flex-col divide-y divide-slate-100">
          {versions?.map((version) => (
            <li
              key={version.id}
              className="flex items-center justify-between gap-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">
                  Version {version.version_number}
                </p>
                <p className="text-xs text-slate-500">
                  {formatDate(version.created_at, 'MMM d, yyyy p')} ·{' '}
                  {formatRelative(version.created_at)} · User #
                  {version.created_by}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setConfirmVersion(version.version_number);
                }}
                className="inline-flex flex-none items-center gap-1.5 rounded-full border border-brand-200 px-3 py-1.5 text-xs font-semibold text-brand-700 transition-colors hover:bg-brand-50"
              >
                <RotateCcw size={13} />
                Restore
              </button>
            </li>
          ))}
        </ul>
      )}

      <Modal
        isOpen={confirmVersion !== null}
        onClose={() => setConfirmVersion(null)}
        title="Restore this version?"
        footer={
          <>
            <button
              type="button"
              onClick={() => setConfirmVersion(null)}
              className="rounded-full px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <GradientButton
              type="button"
              onClick={handleRestore}
              isLoading={restore.isPending}
            >
              Restore
            </GradientButton>
          </>
        }
      >
        <p>
          Restoring version {confirmVersion} will replace the clip&apos;s current
          state with that snapshot. This creates a new version entry.
        </p>
        {error && (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
      </Modal>
    </GlassCard>
  );
}

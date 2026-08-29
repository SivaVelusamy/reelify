import { formatDuration } from '../../lib/utils';
import type { Transcript } from '../../types';

interface TranscriptPreviewProps {
  transcript: Transcript;
}

export function TranscriptPreview({ transcript }: TranscriptPreviewProps) {
  const { segments } = transcript;

  if (segments.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        The transcript has no time-coded segments.
      </p>
    );
  }

  return (
    <div className="max-h-96 overflow-y-auto rounded-2xl border border-slate-200 bg-white/70 p-4">
      <ul className="space-y-3">
        {segments.map((segment, index) => (
          <li key={`${segment.start}-${index}`} className="flex gap-3 text-sm">
            <span className="shrink-0 font-mono text-xs text-brand-600">
              {formatDuration(segment.start)}
            </span>
            <span className="text-slate-700">
              {segment.speaker && (
                <span className="mr-1 font-semibold text-slate-900">
                  {segment.speaker}:
                </span>
              )}
              {segment.text}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

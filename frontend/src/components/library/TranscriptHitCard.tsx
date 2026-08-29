import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { FileText } from 'lucide-react';
import type { SearchHit } from '../../types/library';
import { GlassCard } from '../ui/GlassCard';

interface TranscriptHitCardProps {
  hit: SearchHit;
  query: string;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Strip any HTML tags the backend included in the snippet, then decode entities. */
function sanitizeSnippet(snippet: string): string {
  return snippet
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

/** Re-highlight the query inside plain text using React nodes (no raw HTML). */
function highlight(text: string, query: string): ReactNode[] {
  const trimmed = query.trim();
  if (!trimmed) {
    return [text];
  }
  const parts = text.split(new RegExp(`(${escapeRegExp(trimmed)})`, 'ig'));
  return parts.map((part, index) =>
    part.toLowerCase() === trimmed.toLowerCase() ? (
      <mark
        key={index}
        className="rounded bg-amber-200 px-0.5 text-slate-900"
      >
        {part}
      </mark>
    ) : (
      <span key={index}>{part}</span>
    ),
  );
}

export function TranscriptHitCard({ hit, query }: TranscriptHitCardProps) {
  const snippet = sanitizeSnippet(hit.snippet);

  return (
    <GlassCard className="mb-3 p-4">
      <div className="flex items-start justify-between gap-3">
        <h3 className="text-sm font-semibold text-slate-900">{hit.title}</h3>
        <span className="inline-flex flex-none items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-medium capitalize text-slate-600">
          <FileText size={12} />
          {hit.matched_in}
        </span>
      </div>

      <p className="mt-2 text-sm leading-relaxed text-slate-600">
        {highlight(snippet, query)}
      </p>

      <Link
        to={`/clips/${hit.clip_id}/edit`}
        className="mt-3 inline-flex items-center rounded-full border border-brand-200 px-4 py-1.5 text-xs font-semibold text-brand-700 transition-colors hover:bg-brand-50"
      >
        Open clip
      </Link>
    </GlassCard>
  );
}

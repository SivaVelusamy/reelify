import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search } from 'lucide-react';
import { PageWrapper } from '../components/layout/PageWrapper';
import { AnimatedInput } from '../components/ui/AnimatedInput';
import { AnimatedList } from '../components/ui/AnimatedList';
import { EmptyState } from '../components/ui/EmptyState';
import { GlassCard } from '../components/ui/GlassCard';
import { Spinner } from '../components/ui/Spinner';
import { TranscriptHitCard } from '../components/library/TranscriptHitCard';
import { useLibrarySearch } from '../hooks/useLibrary';

const DEBOUNCE_MS = 300;

export default function SearchResultsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialQuery = searchParams.get('q') ?? '';

  const [input, setInput] = useState(initialQuery);
  const [debounced, setDebounced] = useState(initialQuery);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(input), DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [input]);

  useEffect(() => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        const trimmed = debounced.trim();
        if (trimmed) {
          next.set('q', trimmed);
        } else {
          next.delete('q');
        }
        return next;
      },
      { replace: true },
    );
  }, [debounced, setSearchParams]);

  const trimmed = debounced.trim();
  const { data: hits, isLoading, isError, isFetching } =
    useLibrarySearch(trimmed);

  const showResults = trimmed.length >= 2;

  return (
    <PageWrapper title="Search library">
      <GlassCard className="mb-6">
        <div className="relative">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            <Search size={18} />
          </span>
          <AnimatedInput
            id="library-search"
            aria-label="Search transcripts and titles"
            placeholder="Search transcripts and titles…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="pl-10"
          />
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Type at least two characters to search.
        </p>
      </GlassCard>

      {showResults && (isLoading || isFetching) && (
        <div className="flex justify-center py-16">
          <Spinner size={32} />
        </div>
      )}

      {showResults && isError && !isLoading && (
        <GlassCard>
          <p className="text-sm text-red-600">
            Search failed. Please try again.
          </p>
        </GlassCard>
      )}

      {!showResults && (
        <EmptyState
          icon={Search}
          title="Search your library"
          description="Find clips by words spoken in the transcript or in the clip title."
        />
      )}

      {showResults && !isLoading && !isFetching && !isError && (
        (hits?.length ?? 0) === 0 ? (
          <EmptyState
            icon={Search}
            title="No matches"
            description={`Nothing found for “${trimmed}”. Try different keywords.`}
          />
        ) : (
          <AnimatedList>
            {(hits ?? []).map((hit) => (
              <TranscriptHitCard
                key={hit.clip_id}
                hit={hit}
                query={trimmed}
              />
            ))}
          </AnimatedList>
        )
      )}
    </PageWrapper>
  );
}

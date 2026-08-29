import { useState, type FormEvent } from 'react';
import { AnimatedInput } from '../ui/AnimatedInput';
import { GradientButton } from '../ui/GradientButton';

interface UrlImportFormProps {
  onSubmit: (url: string) => Promise<void> | void;
  isLoading?: boolean;
  submitError?: string | null;
}

const YOUTUBE_PATTERN =
  /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/|live\/)|youtu\.be\/)[\w-]{6,}/i;

export function UrlImportForm({
  onSubmit,
  isLoading = false,
  submitError,
}: UrlImportFormProps) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const trimmed = url.trim();

    if (!trimmed) {
      setError('Enter a YouTube URL.');
      return;
    }
    if (!YOUTUBE_PATTERN.test(trimmed)) {
      setError('That does not look like a valid YouTube URL.');
      return;
    }

    setError(null);
    await onSubmit(trimmed);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <AnimatedInput
        id="youtube-url"
        label="YouTube URL"
        type="url"
        value={url}
        onChange={(event) => setUrl(event.target.value)}
        placeholder="https://www.youtube.com/watch?v=..."
        error={error ?? submitError ?? undefined}
      />
      <GradientButton type="submit" isLoading={isLoading}>
        Import video
      </GradientButton>
    </form>
  );
}

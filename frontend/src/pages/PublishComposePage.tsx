import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Check, Copy, ExternalLink } from 'lucide-react';
import { PageWrapper } from '../components/layout/PageWrapper';
import { GlassCard } from '../components/ui/GlassCard';
import { GradientButton } from '../components/ui/GradientButton';
import { Spinner } from '../components/ui/Spinner';
import { DestinationPicker } from '../components/publishing/DestinationPicker';
import { SchedulePicker } from '../components/publishing/SchedulePicker';
import {
  useCreateShareLink,
  usePublishClip,
  useSocialAccounts,
} from '../hooks/usePublishing';
import {
  EMPTY_DESTINATION_DRAFT,
  type DestinationDraft,
  type PublishInput,
  type ShareLinkResponse,
} from '../types/publishing';

async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to the legacy path
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.focus();
    area.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
}

function buildPublishInput(
  draft: DestinationDraft,
  caption: string,
  scheduledAt: string | null,
): PublishInput | { error: string } {
  const base = { caption_text: caption, scheduled_at: scheduledAt };
  switch (draft.destination_type) {
    case 'social':
      if (!draft.social_account_id) {
        return { error: 'Choose a connected account to publish to.' };
      }
      return {
        ...base,
        destination_type: 'social',
        social_account_id: draft.social_account_id,
      };
    case 'slack':
    case 'teams':
      if (!draft.webhook_url.trim()) {
        return { error: 'Enter the webhook URL for this destination.' };
      }
      return {
        ...base,
        destination_type: draft.destination_type,
        slack_webhook_url: draft.webhook_url.trim(),
      };
    case 'link':
      return { ...base, destination_type: 'link' };
    default:
      return { error: 'Pick a destination.' };
  }
}

export default function PublishComposePage() {
  const { id } = useParams<{ id: string }>();
  const clipId = Number(id);

  const accountsQuery = useSocialAccounts();
  const publishClip = usePublishClip(clipId);
  const createShareLink = useCreateShareLink(clipId);

  const [draft, setDraft] = useState<DestinationDraft>(EMPTY_DESTINATION_DRAFT);
  const [caption, setCaption] = useState('');
  const [scheduledAt, setScheduledAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [published, setPublished] = useState(false);
  const [shareLink, setShareLink] = useState<ShareLinkResponse | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const accounts = accountsQuery.data ?? [];
  const isScheduled = scheduledAt !== null;

  const handlePublish = async (): Promise<void> => {
    setError(null);
    setPublished(false);
    const result = buildPublishInput(draft, caption.trim(), scheduledAt);
    if ('error' in result) {
      setError(result.error);
      return;
    }
    try {
      await publishClip.mutateAsync(result);
      setPublished(true);
    } catch {
      setError('Could not publish this clip. Please try again.');
    }
  };

  const handleCreateShareLink = async (): Promise<void> => {
    setLinkError(null);
    setCopied(false);
    try {
      const link = await createShareLink.mutateAsync();
      setShareLink(link);
    } catch {
      setLinkError('Could not create a share link. Please try again.');
    }
  };

  const handleCopy = async (): Promise<void> => {
    if (!shareLink) {
      return;
    }
    const ok = await copyToClipboard(shareLink.url);
    setCopied(ok);
    if (!ok) {
      setLinkError('Could not copy automatically — copy the link manually.');
    }
  };

  return (
    <PageWrapper title="Publish clip">
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
            <h2 className="mb-3 text-lg font-semibold text-slate-900">
              Destination
            </h2>
            {accountsQuery.isLoading ? (
              <div className="flex justify-center py-6">
                <Spinner size={24} />
              </div>
            ) : (
              <DestinationPicker
                accounts={accounts}
                value={draft}
                onChange={setDraft}
              />
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="publish-caption"
              className="text-sm font-medium text-slate-700"
            >
              Caption
            </label>
            <textarea
              id="publish-caption"
              value={caption}
              onChange={(event) => setCaption(event.target.value)}
              rows={4}
              placeholder="Write a caption for this destination…"
              className="rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
            />
          </div>

          <div>
            <h3 className="mb-2 text-sm font-medium text-slate-700">Timing</h3>
            <SchedulePicker value={scheduledAt} onChange={setScheduledAt} />
          </div>

          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}
          {published && (
            <p className="text-sm text-emerald-700">
              {isScheduled
                ? 'Scheduled. Track it in the publish queue.'
                : 'Publishing started. Track it in the publish queue.'}
            </p>
          )}

          <GradientButton
            type="button"
            onClick={() => void handlePublish()}
            isLoading={publishClip.isPending}
          >
            {isScheduled ? 'Schedule' : 'Publish'}
          </GradientButton>
        </GlassCard>

        <GlassCard className="flex flex-col gap-4">
          <h2 className="text-lg font-semibold text-slate-900">Share link</h2>
          <p className="text-sm text-slate-500">
            Create a public link to this clip that anyone can open without a
            Reelify account.
          </p>

          <GradientButton
            type="button"
            onClick={() => void handleCreateShareLink()}
            isLoading={createShareLink.isPending}
          >
            Create share link
          </GradientButton>

          {shareLink && (
            <div className="flex flex-col gap-2 rounded-xl bg-slate-50 p-3">
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  value={shareLink.url}
                  aria-label="Share link URL"
                  className="w-full flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-700"
                />
                <button
                  type="button"
                  onClick={() => void handleCopy()}
                  aria-label="Copy share link"
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <a
                href={shareLink.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline"
              >
                <ExternalLink size={13} />
                Open link
              </a>
              <p className="text-xs text-slate-500">
                {shareLink.is_active ? 'Active' : 'Inactive'} ·{' '}
                {shareLink.view_count} views
                {shareLink.expires_at
                  ? ` · expires ${new Date(shareLink.expires_at).toLocaleString()}`
                  : ''}
              </p>
            </div>
          )}

          {linkError && (
            <p className="text-sm text-red-600" role="alert">
              {linkError}
            </p>
          )}
        </GlassCard>
      </div>
    </PageWrapper>
  );
}

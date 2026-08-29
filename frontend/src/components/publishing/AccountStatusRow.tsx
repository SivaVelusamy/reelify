import { useState } from 'react';
import {
  Instagram,
  Music2,
  Slack,
  Users,
  Youtube,
  type LucideIcon,
} from 'lucide-react';
import { GradientButton } from '../ui/GradientButton';
import { StatusBadge } from '../ui/StatusBadge';
import { Modal } from '../ui/Modal';
import { useDisconnectAccount } from '../../hooks/usePublishing';
import { PLATFORM_LABELS } from '../../types/publishing';
import { formatDate } from '../../lib/utils';
import type { SocialAccount, SocialPlatform } from '../../types';

const PLATFORM_ICON: Record<SocialPlatform, LucideIcon> = {
  tiktok: Music2,
  instagram: Instagram,
  youtube: Youtube,
  slack: Slack,
  teams: Users,
};

interface AccountStatusRowProps {
  account: SocialAccount;
}

export function AccountStatusRow({ account }: AccountStatusRowProps) {
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const disconnect = useDisconnectAccount();

  const Icon = PLATFORM_ICON[account.platform];

  const handleDisconnect = async (): Promise<void> => {
    setError(null);
    try {
      await disconnect.mutateAsync(account.id);
      setIsConfirmOpen(false);
    } catch {
      setError('Could not disconnect this account. Please try again.');
    }
  };

  return (
    <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white px-4 py-3">
      <div className="flex items-center gap-3">
        <span className="rounded-full bg-slate-100 p-2 text-slate-600">
          <Icon size={18} />
        </span>
        <div>
          <p className="text-sm font-semibold text-slate-800">
            {account.display_name || PLATFORM_LABELS[account.platform]}
          </p>
          <p className="text-xs text-slate-500">
            {PLATFORM_LABELS[account.platform]}
            {account.token_expires_at
              ? ` · token expires ${formatDate(account.token_expires_at)}`
              : ''}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <StatusBadge status={account.status} />
        <button
          type="button"
          onClick={() => setIsConfirmOpen(true)}
          className="text-sm font-semibold text-red-600 hover:underline"
        >
          Disconnect
        </button>
      </div>

      <Modal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        title="Disconnect account"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsConfirmOpen(false)}
              className="rounded-full px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
            >
              Cancel
            </button>
            <GradientButton
              type="button"
              onClick={() => void handleDisconnect()}
              isLoading={disconnect.isPending}
            >
              Disconnect
            </GradientButton>
          </>
        }
      >
        <p>
          Scheduled posts using{' '}
          <span className="font-semibold">
            {account.display_name || PLATFORM_LABELS[account.platform]}
          </span>{' '}
          will fail until you reconnect. Continue?
        </p>
        {error && (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
      </Modal>
    </div>
  );
}

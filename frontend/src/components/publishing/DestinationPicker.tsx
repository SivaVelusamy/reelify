import { Link2, MessageSquare, Send, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { AnimatedInput } from '../ui/AnimatedInput';
import { PLATFORM_LABELS } from '../../types/publishing';
import type { DestinationDraft, DestinationType } from '../../types/publishing';
import type { SocialAccount } from '../../types';
import { cn } from '../../lib/utils';

interface DestinationOption {
  value: DestinationType;
  label: string;
  description: string;
  icon: LucideIcon;
}

const OPTIONS: DestinationOption[] = [
  {
    value: 'social',
    label: 'Social account',
    description: 'Post to a connected TikTok, Instagram or YouTube account.',
    icon: Send,
  },
  {
    value: 'slack',
    label: 'Slack',
    description: 'Send the clip to a Slack channel via an incoming webhook.',
    icon: MessageSquare,
  },
  {
    value: 'teams',
    label: 'Microsoft Teams',
    description: 'Send the clip to a Teams channel via an incoming webhook.',
    icon: Users,
  },
  {
    value: 'link',
    label: 'Share link',
    description: 'Create a public link anyone can open — no account needed.',
    icon: Link2,
  },
];

interface DestinationPickerProps {
  accounts: SocialAccount[];
  value: DestinationDraft;
  onChange: (value: DestinationDraft) => void;
}

export function DestinationPicker({
  accounts,
  value,
  onChange,
}: DestinationPickerProps) {
  const connectedAccounts = accounts.filter(
    (account) => account.status === 'connected',
  );

  const selectType = (destinationType: DestinationType): void => {
    onChange({ ...value, destination_type: destinationType });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {OPTIONS.map((option) => {
          const Icon = option.icon;
          const active = value.destination_type === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => selectType(option.value)}
              aria-pressed={active}
              className={cn(
                'flex flex-col gap-1 rounded-xl border p-3 text-left transition-colors',
                active
                  ? 'border-brand-500 bg-brand-50'
                  : 'border-slate-200 bg-white hover:bg-slate-50',
              )}
            >
              <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-800">
                <Icon size={16} />
                {option.label}
              </span>
              <span className="text-xs text-slate-500">{option.description}</span>
            </button>
          );
        })}
      </div>

      {value.destination_type === 'social' && (
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="destination-account"
            className="text-sm font-medium text-slate-700"
          >
            Connected account
          </label>
          {connectedAccounts.length === 0 ? (
            <p className="text-sm text-amber-700">
              No connected accounts. Add one from Settings → Connections first.
            </p>
          ) : (
            <select
              id="destination-account"
              value={value.social_account_id ?? ''}
              onChange={(event) =>
                onChange({
                  ...value,
                  social_account_id: event.target.value
                    ? Number(event.target.value)
                    : null,
                })
              }
              className="rounded-xl border-2 border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-brand-500"
            >
              <option value="">Select an account…</option>
              {connectedAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {(account.display_name ||
                    PLATFORM_LABELS[account.platform]) +
                    ` (${PLATFORM_LABELS[account.platform]})`}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {(value.destination_type === 'slack' ||
        value.destination_type === 'teams') && (
        <AnimatedInput
          id="destination-webhook"
          label={`${PLATFORM_LABELS[value.destination_type]} webhook URL`}
          type="url"
          placeholder="https://hooks.slack.com/services/…"
          value={value.webhook_url}
          onChange={(event) =>
            onChange({ ...value, webhook_url: event.target.value })
          }
        />
      )}

      {value.destination_type === 'link' && (
        <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
          Publishing here creates a public share link for this clip. You can copy
          it and share it anywhere — viewers do not need a Reelify account.
        </p>
      )}
    </div>
  );
}

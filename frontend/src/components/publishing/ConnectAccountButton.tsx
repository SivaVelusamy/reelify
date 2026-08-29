import { motion } from 'framer-motion';
import {
  Instagram,
  Music2,
  Slack,
  Users,
  Youtube,
  type LucideIcon,
} from 'lucide-react';
import { useConnectAccount } from '../../hooks/usePublishing';
import { PLATFORM_LABELS, type Platform } from '../../types/publishing';
import { cn } from '../../lib/utils';

const PLATFORM_ICON: Record<Platform, LucideIcon> = {
  tiktok: Music2,
  instagram: Instagram,
  youtube: Youtube,
  slack: Slack,
  teams: Users,
};

interface ConnectAccountButtonProps {
  platform: Platform;
  /** When true the button reads "Reconnect" instead of "Connect". */
  isConnected?: boolean;
  className?: string;
}

export function ConnectAccountButton({
  platform,
  isConnected = false,
  className,
}: ConnectAccountButtonProps) {
  const connect = useConnectAccount();
  const Icon = PLATFORM_ICON[platform];
  const label = PLATFORM_LABELS[platform];

  const handleClick = (): void => {
    connect.mutate(platform);
  };

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <motion.button
        type="button"
        whileHover={{ scale: 1.02, y: -2 }}
        whileTap={{ scale: 0.98 }}
        onClick={handleClick}
        disabled={connect.isPending}
        className={cn(
          'inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2',
          'text-sm font-semibold text-slate-700 hover:border-brand-300 hover:bg-brand-50',
          'disabled:cursor-not-allowed disabled:opacity-60',
        )}
      >
        <Icon size={16} />
        {connect.isPending
          ? 'Redirecting…'
          : `${isConnected ? 'Reconnect' : 'Connect'} ${label}`}
      </motion.button>
      {connect.isError && (
        <p className="text-xs text-red-600" role="alert">
          Could not start the connection. Please try again.
        </p>
      )}
    </div>
  );
}

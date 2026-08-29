import {
  ChevronRight,
  CreditCard,
  Link2,
  Palette,
  UserCircle,
  type LucideIcon,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageWrapper } from '../components/layout/PageWrapper';
import { GlassCard } from '../components/ui/GlassCard';
import { Spinner } from '../components/ui/Spinner';
import { useDashboardSummary } from '../hooks/useDashboard';
import { formatDate } from '../lib/utils';

interface SettingsLink {
  to: string;
  label: string;
  description: string;
  icon: LucideIcon;
}

const LINKS: SettingsLink[] = [
  {
    to: '/profile',
    label: 'Profile',
    description: 'Your name, email, and account details.',
    icon: UserCircle,
  },
  {
    to: '/settings/brand',
    label: 'Brand Kit',
    description: 'Colors, fonts, logo, and caption style presets.',
    icon: Palette,
  },
  {
    to: '/settings/connections',
    label: 'Connections',
    description: 'Linked social and internal publishing destinations.',
    icon: Link2,
  },
  {
    to: '/billing',
    label: 'Billing',
    description: 'Plan, invoices, and payment method.',
    icon: CreditCard,
  },
];

export default function SettingsPage() {
  const { data: summary, isLoading, isError } = useDashboardSummary();

  return (
    <PageWrapper title="Settings">
      <GlassCard className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">Current plan</p>
          {isLoading ? (
            <Spinner size={20} />
          ) : isError || !summary ? (
            <p className="text-sm text-slate-500">Plan details unavailable.</p>
          ) : (
            <p className="text-lg font-semibold capitalize text-slate-900">
              {summary.plan}
              <span className="ml-2 text-sm font-normal text-slate-500">
                renews {formatDate(summary.period_end)}
              </span>
            </p>
          )}
        </div>
        <Link
          to="/billing"
          className="text-sm font-semibold text-brand-600 hover:text-brand-700"
        >
          Manage
        </Link>
      </GlassCard>

      <div className="grid gap-4 sm:grid-cols-2">
        {LINKS.map(({ to, label, description, icon: Icon }) => (
          <Link key={to} to={to} className="block">
            <GlassCard className="flex items-center gap-4">
              <span className="rounded-full bg-brand-100 p-3 text-brand-600">
                <Icon size={20} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-slate-900">{label}</p>
                <p className="text-sm text-slate-500">{description}</p>
              </div>
              <ChevronRight size={18} className="shrink-0 text-slate-400" />
            </GlassCard>
          </Link>
        ))}
      </div>
    </PageWrapper>
  );
}

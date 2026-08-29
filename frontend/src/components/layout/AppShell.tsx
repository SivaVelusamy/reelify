import { motion } from 'framer-motion';
import {
  CalendarClock,
  CreditCard,
  LayoutDashboard,
  Library,
  Link2,
  Palette,
  Send,
  Shield,
  Video,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { cn } from '../../lib/utils';
import { TopBar } from './TopBar';

interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  adminOnly?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard', to: '/dashboard', icon: LayoutDashboard },
  { label: 'Projects', to: '/projects', icon: Video },
  { label: 'Library', to: '/library', icon: Library },
  { label: 'Publish', to: '/publish', icon: Send },
  { label: 'Calendar', to: '/publish/calendar', icon: CalendarClock },
  { label: 'Brand Kit', to: '/settings/brand', icon: Palette },
  { label: 'Connections', to: '/settings/connections', icon: Link2 },
  { label: 'Billing', to: '/billing', icon: CreditCard },
  { label: 'Admin', to: '/admin', icon: Shield, adminOnly: true },
];

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { user } = useAuth();
  const items = NAV_ITEMS.filter(
    (item) => !item.adminOnly || user?.is_admin,
  );

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="hidden w-60 flex-col border-r border-slate-200 bg-white/80 p-4 backdrop-blur lg:flex">
        <div className="mb-8 px-2 text-xl font-extrabold">
          <span className="bg-brand-gradient bg-clip-text text-transparent">
            Reelify
          </span>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/publish' || item.to === '/settings/brand'}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-brand-100 text-brand-700'
                    : 'text-slate-600 hover:bg-slate-100',
                )
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <motion.main
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex-1 overflow-y-auto p-6"
        >
          {children}
        </motion.main>
      </div>
    </div>
  );
}

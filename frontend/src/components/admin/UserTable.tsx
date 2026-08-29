import { motion } from 'framer-motion';
import { AlertCircle, Search } from 'lucide-react';
import { GradientButton } from '../ui/GradientButton';
import { Spinner } from '../ui/Spinner';
import { StatusBadge } from '../ui/StatusBadge';
import { EmptyState } from '../ui/EmptyState';
import { cn, formatDate } from '../../lib/utils';
import {
  ADMIN_USER_PLANS,
  type AdminUserFilters,
  type AdminUserRow,
  type AdminUserStatus,
  type PaginatedUsers,
} from '../../types/admin';

interface UserTableProps {
  filters: AdminUserFilters;
  /** Merge a partial patch into the lifted filter state (page resets handled by page). */
  onFiltersChange: (patch: Partial<AdminUserFilters>) => void;
  data: PaginatedUsers | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onEdit: (user: AdminUserRow) => void;
  onToggleActive: (user: AdminUserRow) => void;
  /** Id of the row whose active-toggle mutation is in flight, if any. */
  togglingId: number | null;
}

const STATUS_OPTIONS: Array<{ value: '' | AdminUserStatus; label: string }> = [
  { value: '', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

export function UserTable({
  filters,
  onFiltersChange,
  data,
  isLoading,
  isError,
  onRetry,
  onEdit,
  onToggleActive,
  togglingId,
}: UserTableProps) {
  const users = data?.items ?? [];
  const page = data?.page ?? filters.page ?? 1;
  const perPage = data?.per_page ?? filters.per_page ?? 20;
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const canPrev = page > 1;
  const canNext = page < totalPages;

  return (
    <div className="flex flex-col gap-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            type="search"
            value={filters.q ?? ''}
            onChange={(event) => onFiltersChange({ q: event.target.value })}
            placeholder="Search by email or name"
            className="w-full rounded-xl border-2 border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm outline-none focus:border-brand-500"
          />
        </div>

        <select
          value={filters.plan ?? ''}
          onChange={(event) =>
            onFiltersChange({ plan: event.target.value || undefined })
          }
          className="rounded-xl border-2 border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-500"
        >
          <option value="">All plans</option>
          {ADMIN_USER_PLANS.map((plan) => (
            <option key={plan} value={plan}>
              {plan.charAt(0).toUpperCase() + plan.slice(1)}
            </option>
          ))}
        </select>

        <select
          value={filters.status ?? ''}
          onChange={(event) =>
            onFiltersChange({
              status: (event.target.value || undefined) as
                | AdminUserStatus
                | undefined,
            })
          }
          className="rounded-xl border-2 border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-500"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {isLoading && (
        <div className="flex justify-center py-16">
          <Spinner size={32} />
        </div>
      )}

      {isError && !isLoading && (
        <EmptyState
          icon={AlertCircle}
          title="Could not load users"
          description="Something went wrong while fetching the user list."
          action={
            <GradientButton type="button" onClick={onRetry}>
              Try again
            </GradientButton>
          }
        />
      )}

      {!isLoading && !isError && users.length === 0 && (
        <EmptyState
          title="No users match"
          description="Try adjusting the search or filters."
        />
      )}

      {!isLoading && !isError && users.length > 0 && (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full min-w-[760px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-3 font-semibold">User</th>
                <th className="px-4 py-3 font-semibold">Plan</th>
                <th className="px-4 py-3 font-semibold">Minutes / mo</th>
                <th className="px-4 py-3 font-semibold">Clips</th>
                <th className="px-4 py-3 font-semibold">Active</th>
                <th className="px-4 py-3 font-semibold">Role</th>
                <th className="px-4 py-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr
                  key={user.id}
                  className="border-b border-slate-100 last:border-0 hover:bg-slate-50"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">
                      {user.full_name ?? '—'}
                    </div>
                    <div className="text-xs text-slate-500">{user.email}</div>
                    <div className="text-xs text-slate-400">
                      Joined {formatDate(user.created_at)}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={user.plan} />
                  </td>
                  <td className="px-4 py-3 tabular-nums text-slate-700">
                    {user.minutes_this_month}
                  </td>
                  <td className="px-4 py-3 tabular-nums text-slate-700">
                    {user.clips_count}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={user.is_active}
                      aria-label={
                        user.is_active
                          ? `Deactivate ${user.email}`
                          : `Activate ${user.email}`
                      }
                      disabled={togglingId === user.id}
                      onClick={() => onToggleActive(user)}
                      className={cn(
                        'relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50',
                        user.is_active ? 'bg-emerald-500' : 'bg-slate-300',
                      )}
                    >
                      <motion.span
                        layout
                        className="inline-block h-4 w-4 rounded-full bg-white shadow"
                        animate={{ x: user.is_active ? 24 : 4 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      />
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    {user.is_admin ? (
                      <StatusBadge status="admin" className="capitalize" />
                    ) : (
                      <span className="text-xs text-slate-400">Member</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => onEdit(user)}
                      className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition-colors hover:border-brand-400 hover:text-brand-600"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {!isLoading && !isError && total > 0 && (
        <div className="flex items-center justify-between text-sm text-slate-600">
          <span>
            Page {page} of {totalPages} · {total} user{total === 1 ? '' : 's'}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={!canPrev}
              onClick={() => onFiltersChange({ page: page - 1 })}
              className="rounded-full border border-slate-200 px-4 py-1.5 font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Previous
            </button>
            <button
              type="button"
              disabled={!canNext}
              onClick={() => onFiltersChange({ page: page + 1 })}
              className="rounded-full border border-slate-200 px-4 py-1.5 font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

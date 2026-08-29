import { useMemo, useState } from 'react';
import { PageWrapper } from '../components/layout/PageWrapper';
import { UserTable } from '../components/admin/UserTable';
import { EditUserDialog } from '../components/admin/EditUserDialog';
import { useAdminUsers, useUpdateAdminUser } from '../hooks/useAdmin';
import type { AdminUserFilters, AdminUserRow } from '../types/admin';

const PER_PAGE = 20;

export default function AdminUsersPage() {
  const [filters, setFilters] = useState<AdminUserFilters>({
    page: 1,
    per_page: PER_PAGE,
  });
  const [editing, setEditing] = useState<AdminUserRow | null>(null);

  const queryFilters = useMemo<AdminUserFilters>(
    () => ({
      page: filters.page,
      per_page: filters.per_page,
      q: filters.q?.trim() ? filters.q.trim() : undefined,
      plan: filters.plan,
      status: filters.status,
    }),
    [filters],
  );

  const { data, isLoading, isError, refetch } = useAdminUsers(queryFilters);
  const updateUser = useUpdateAdminUser();

  const handleFiltersChange = (patch: Partial<AdminUserFilters>): void => {
    setFilters((prev) => {
      const next = { ...prev, ...patch };
      // Any filter change other than an explicit page move resets to page 1.
      if (!('page' in patch)) {
        next.page = 1;
      }
      return next;
    });
  };

  const handleToggleActive = (user: AdminUserRow): void => {
    updateUser.mutate({ id: user.id, patch: { is_active: !user.is_active } });
  };

  const togglingId =
    updateUser.isPending && updateUser.variables
      ? updateUser.variables.id
      : null;

  return (
    <PageWrapper title="Users">
      <UserTable
        filters={filters}
        onFiltersChange={handleFiltersChange}
        data={data}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => void refetch()}
        onEdit={setEditing}
        onToggleActive={handleToggleActive}
        togglingId={togglingId}
      />

      <EditUserDialog
        user={editing}
        isOpen={editing !== null}
        onClose={() => setEditing(null)}
      />
    </PageWrapper>
  );
}

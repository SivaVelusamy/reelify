import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Modal } from '../ui/Modal';
import { GradientButton } from '../ui/GradientButton';
import { Spinner } from '../ui/Spinner';
import { cn } from '../../lib/utils';
import { getApiErrorMessage } from '../../services/authService';
import { useUpdateAdminUser } from '../../hooks/useAdmin';
import {
  ADMIN_USER_PLANS,
  type AdminUserRow,
  type AdminUserUpdate,
} from '../../types/admin';

interface EditUserDialogProps {
  user: AdminUserRow | null;
  isOpen: boolean;
  onClose: () => void;
}

interface RowSwitchProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}

function RowSwitch({ label, description, checked, onChange }: RowSwitchProps) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div>
        <p className="font-medium text-slate-800">{label}</p>
        <p className="text-xs text-slate-500">{description}</p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors',
          checked ? 'bg-brand-500' : 'bg-slate-300',
        )}
      >
        <motion.span
          layout
          className="inline-block h-4 w-4 rounded-full bg-white shadow"
          animate={{ x: checked ? 24 : 4 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
        />
      </button>
    </div>
  );
}

export function EditUserDialog({ user, isOpen, onClose }: EditUserDialogProps) {
  const mutation = useUpdateAdminUser();
  const [isActive, setIsActive] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [plan, setPlan] = useState<string>('free');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setIsActive(user.is_active);
      setIsAdmin(user.is_admin);
      setPlan(user.plan);
      setErrorMessage(null);
      mutation.reset();
    }
    // Only re-sync when the target user changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleSave = async (): Promise<void> => {
    if (!user) {
      return;
    }
    setErrorMessage(null);
    const patch: AdminUserUpdate = {};
    if (isActive !== user.is_active) {
      patch.is_active = isActive;
    }
    if (isAdmin !== user.is_admin) {
      patch.is_admin = isAdmin;
    }
    if (plan !== user.plan) {
      patch.plan = plan;
    }
    if (Object.keys(patch).length === 0) {
      onClose();
      return;
    }
    try {
      await mutation.mutateAsync({ id: user.id, patch });
      onClose();
    } catch (error) {
      setErrorMessage(getApiErrorMessage(error, 'Could not update this user.'));
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={user ? `Edit ${user.email}` : 'Edit user'}
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <GradientButton
            type="button"
            onClick={() => void handleSave()}
            isLoading={mutation.isPending}
          >
            Save changes
          </GradientButton>
        </>
      }
    >
      {user ? (
        <div className="flex flex-col divide-y divide-slate-100">
          <RowSwitch
            label="Active"
            description="Inactive users cannot sign in or process videos."
            checked={isActive}
            onChange={setIsActive}
          />
          <RowSwitch
            label="Administrator"
            description="Grants access to the admin panel and all accounts."
            checked={isAdmin}
            onChange={setIsAdmin}
          />
          <div className="py-3">
            <label
              htmlFor="admin-edit-plan"
              className="mb-1 block font-medium text-slate-800"
            >
              Plan
            </label>
            <select
              id="admin-edit-plan"
              value={plan}
              onChange={(event) => setPlan(event.target.value)}
              className="w-full rounded-xl border-2 border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand-500"
            >
              {ADMIN_USER_PLANS.map((option) => (
                <option key={option} value={option}>
                  {option.charAt(0).toUpperCase() + option.slice(1)}
                </option>
              ))}
              {!ADMIN_USER_PLANS.includes(
                plan as (typeof ADMIN_USER_PLANS)[number],
              ) && <option value={plan}>{plan}</option>}
            </select>
          </div>

          {errorMessage && (
            <p className="pt-3 text-sm font-medium text-red-600">
              {errorMessage}
            </p>
          )}
        </div>
      ) : (
        <div className="flex justify-center py-8">
          <Spinner size={28} />
        </div>
      )}
    </Modal>
  );
}

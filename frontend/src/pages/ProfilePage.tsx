import { useEffect, useState, type FormEvent } from 'react';
import { PageWrapper } from '../components/layout/PageWrapper';
import { GlassCard } from '../components/ui/GlassCard';
import { AnimatedInput } from '../components/ui/AnimatedInput';
import { GradientButton } from '../components/ui/GradientButton';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Spinner } from '../components/ui/Spinner';
import { useAuth } from '../hooks/useAuth';
import { useProfileMutation } from '../hooks/useProfileMutation';
import { getApiErrorMessage } from '../services/authService';

export default function ProfilePage() {
  const { user, refreshUser } = useAuth();
  const mutation = useProfileMutation();

  const [fullName, setFullName] = useState(user?.full_name ?? '');
  const [error, setError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);

  useEffect(() => {
    setFullName(user?.full_name ?? '');
  }, [user?.full_name]);

  if (!user) {
    return (
      <PageWrapper title="Profile">
        <div className="flex items-center justify-center py-20">
          <Spinner size={32} />
        </div>
      </PageWrapper>
    );
  }

  const isDirty = fullName.trim() !== (user.full_name ?? '');

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    setError(null);
    setIsSaved(false);

    if (fullName.trim().length === 0) {
      setError('Name cannot be empty.');
      return;
    }

    try {
      await mutation.mutateAsync({ full_name: fullName.trim() });
      await refreshUser();
      setIsSaved(true);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Could not save your profile.'));
    }
  };

  return (
    <PageWrapper title="Profile">
      <GlassCard className="max-w-xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500">Signed in as</p>
            <p className="font-medium text-slate-900">{user.email}</p>
          </div>
          <StatusBadge status={user.plan} />
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <p
              role="alert"
              className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-600"
            >
              {error}
            </p>
          )}

          {isSaved && !error && (
            <p
              role="status"
              className="rounded-xl bg-emerald-50 px-4 py-2 text-sm text-emerald-700"
            >
              Profile updated.
            </p>
          )}

          <AnimatedInput
            id="profile-email"
            label="Email"
            type="email"
            value={user.email}
            disabled
            readOnly
          />

          <AnimatedInput
            id="profile-full-name"
            label="Full name"
            type="text"
            autoComplete="name"
            value={fullName}
            onChange={(event) => {
              setFullName(event.target.value);
              setIsSaved(false);
            }}
          />

          <GradientButton
            type="submit"
            className="w-full"
            isLoading={mutation.isPending}
            disabled={!isDirty}
          >
            Save changes
          </GradientButton>
        </form>
      </GlassCard>
    </PageWrapper>
  );
}

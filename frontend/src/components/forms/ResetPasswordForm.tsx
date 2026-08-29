import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatedInput } from '../ui/AnimatedInput';
import { GradientButton } from '../ui/GradientButton';
import { getApiErrorMessage, resetPassword } from '../../services/authService';

const MIN_PASSWORD_LENGTH = 8;

export default function ResetPasswordForm() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    setError(null);

    if (!token) {
      setError('This reset link is missing its token. Request a new one.');
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      await resetPassword(token, password);
      navigate('/login', { replace: true });
    } catch (err) {
      setError(
        getApiErrorMessage(err, 'Unable to reset your password. The link may have expired.'),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-slate-900">Set a new password</h1>
        <p className="mt-1 text-sm text-slate-500">
          Choose a password you don&apos;t use anywhere else
        </p>
      </div>

      {!token && (
        <p
          role="alert"
          className="rounded-xl bg-amber-50 px-4 py-2 text-sm text-amber-700"
        >
          This link is missing its reset token.{' '}
          <Link to="/forgot-password" className="font-medium underline">
            Request a new one
          </Link>
          .
        </p>
      )}

      {error && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-600"
        >
          {error}
        </p>
      )}

      <AnimatedInput
        id="reset-password"
        label="New password"
        type="password"
        autoComplete="new-password"
        minLength={MIN_PASSWORD_LENGTH}
        required
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />

      <AnimatedInput
        id="reset-confirm"
        label="Confirm new password"
        type="password"
        autoComplete="new-password"
        minLength={MIN_PASSWORD_LENGTH}
        required
        value={confirm}
        onChange={(event) => setConfirm(event.target.value)}
      />

      <GradientButton
        type="submit"
        className="w-full"
        isLoading={isSubmitting}
      >
        Reset password
      </GradientButton>

      <p className="text-center text-sm text-slate-500">
        <Link to="/login" className="hover:text-brand-600">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}

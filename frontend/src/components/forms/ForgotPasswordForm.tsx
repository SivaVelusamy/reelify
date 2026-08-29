import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AnimatedInput } from '../ui/AnimatedInput';
import { GradientButton } from '../ui/GradientButton';
import { forgotPassword, getApiErrorMessage } from '../../services/authService';

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await forgotPassword(email.trim());
      setIsSent(true);
    } catch (err) {
      setError(
        getApiErrorMessage(err, 'Unable to send the reset email right now.'),
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSent) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <h1 className="text-2xl font-bold text-slate-900">Check your email</h1>
        <p className="text-sm text-slate-500">
          If an account exists for <span className="font-medium">{email}</span>,
          we&apos;ve sent a link to reset your password. The link expires soon,
          so use it promptly.
        </p>
        <Link
          to="/login"
          className="text-sm font-medium text-brand-600 hover:text-brand-700"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-slate-900">Forgot password</h1>
        <p className="mt-1 text-sm text-slate-500">
          Enter your email and we&apos;ll send you a reset link
        </p>
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-xl bg-red-50 px-4 py-2 text-sm text-red-600"
        >
          {error}
        </p>
      )}

      <AnimatedInput
        id="forgot-email"
        label="Email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />

      <GradientButton
        type="submit"
        className="w-full"
        isLoading={isSubmitting}
      >
        Send reset link
      </GradientButton>

      <p className="text-center text-sm text-slate-500">
        Remembered it?{' '}
        <Link to="/login" className="hover:text-brand-600">
          Sign in
        </Link>
      </p>
    </form>
  );
}

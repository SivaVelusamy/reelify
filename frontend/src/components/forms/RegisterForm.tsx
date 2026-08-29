import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatedInput } from '../ui/AnimatedInput';
import { GradientButton } from '../ui/GradientButton';
import { useAuth } from '../../hooks/useAuth';
import { getApiErrorMessage } from '../../services/authService';

const MIN_PASSWORD_LENGTH = 8;

interface StrengthHint {
  label: string;
  className: string;
}

function passwordStrength(password: string): StrengthHint {
  if (password.length === 0) {
    return { label: '', className: 'text-slate-400' };
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      label: `Use at least ${MIN_PASSWORD_LENGTH} characters`,
      className: 'text-red-500',
    };
  }

  let score = 0;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;
  if (password.length >= 12) score += 1;

  if (score >= 3) {
    return { label: 'Strong password', className: 'text-emerald-600' };
  }
  if (score === 2) {
    return { label: 'Fair password', className: 'text-amber-600' };
  }
  return { label: 'Weak password — add numbers or symbols', className: 'text-amber-600' };
}

export default function RegisterForm() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const strength = useMemo(() => passwordStrength(password), [password]);

  const handleSubmit = async (
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> => {
    event.preventDefault();
    setError(null);

    if (fullName.trim().length === 0) {
      setError('Please enter your name.');
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    setIsSubmitting(true);
    try {
      await register(email.trim(), password, fullName.trim());
      navigate('/dashboard', { replace: true });
    } catch (err) {
      setError(getApiErrorMessage(err, 'Unable to create your account.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-slate-900">Create your account</h1>
        <p className="mt-1 text-sm text-slate-500">
          Start turning long videos into short clips
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
        id="register-name"
        label="Full name"
        type="text"
        autoComplete="name"
        required
        value={fullName}
        onChange={(event) => setFullName(event.target.value)}
      />

      <AnimatedInput
        id="register-email"
        label="Email"
        type="email"
        autoComplete="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />

      <div>
        <AnimatedInput
          id="register-password"
          label="Password"
          type="password"
          autoComplete="new-password"
          minLength={MIN_PASSWORD_LENGTH}
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        {strength.label && (
          <p className={`mt-1 text-xs font-medium ${strength.className}`}>
            {strength.label}
          </p>
        )}
      </div>

      <GradientButton
        type="submit"
        className="w-full"
        isLoading={isSubmitting}
      >
        Create account
      </GradientButton>

      <p className="text-center text-sm text-slate-500">
        Already have an account?{' '}
        <Link to="/login" className="hover:text-brand-600">
          Sign in
        </Link>
      </p>
    </form>
  );
}

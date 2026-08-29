import { Navigate } from 'react-router-dom';
import { MeshBackground } from '../components/layout/MeshBackground';
import { PageWrapper } from '../components/layout/PageWrapper';
import { GlassCard } from '../components/ui/GlassCard';
import { Spinner } from '../components/ui/Spinner';
import ForgotPasswordForm from '../components/forms/ForgotPasswordForm';
import { useAuth } from '../hooks/useAuth';

export default function ForgotPasswordPage() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Spinner size={32} />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <>
      <MeshBackground />
      <PageWrapper className="flex items-center justify-center p-4">
        <GlassCard className="w-full max-w-md">
          <ForgotPasswordForm />
        </GlassCard>
      </PageWrapper>
    </>
  );
}

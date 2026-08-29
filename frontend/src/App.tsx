import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { AdminRoute } from './components/auth/AdminRoute';
import { AppShell } from './components/layout/AppShell';
import { ErrorBoundary } from './components/layout/ErrorBoundary';
import { MeshBackground } from './components/layout/MeshBackground';
import { Spinner } from './components/ui/Spinner';

const Placeholder = lazy(() => import('./pages/_Placeholder'));

// ---- Real pages (wired as their FRONTEND-AGENT module lands) ----
// Module 1: Authentication
const LoginPage = lazy(() => import('./pages/LoginPage'));
const RegisterPage = lazy(() => import('./pages/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
// Module 2: Projects / Uploads
const ProjectListPage = lazy(() => import('./pages/ProjectListPage'));
const ProjectDetailPage = lazy(() => import('./pages/ProjectDetailPage'));
const UploadPage = lazy(() => import('./pages/UploadPage'));
const SourceVideoPage = lazy(() => import('./pages/SourceVideoPage'));
// Module 3: Clips
const ClipCandidatesPage = lazy(() => import('./pages/ClipCandidatesPage'));
const ClipEditorPage = lazy(() => import('./pages/ClipEditorPage'));
const ClipExportPage = lazy(() => import('./pages/ClipExportPage'));
// Module 4: Library / Assets
const LibraryPage = lazy(() => import('./pages/LibraryPage'));
const SearchResultsPage = lazy(() => import('./pages/SearchResultsPage'));
const LibraryClipPage = lazy(() => import('./pages/LibraryClipPage'));
// Module 5: Templates / Brand Kit
const BrandKitPage = lazy(() => import('./pages/BrandKitPage'));
const CaptionPresetPage = lazy(() => import('./pages/CaptionPresetPage'));
// Module 8: Publishing / Distribution
const PublishComposePage = lazy(() => import('./pages/PublishComposePage'));
const PublishQueuePage = lazy(() => import('./pages/PublishQueuePage'));
const PublishCalendarPage = lazy(() => import('./pages/PublishCalendarPage'));
const ConnectionsPage = lazy(() => import('./pages/ConnectionsPage'));
const PublicClipPage = lazy(() => import('./pages/PublicClipPage'));
// Module 6: Dashboard
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
// Module 7: Billing
const BillingPage = lazy(() => import('./pages/BillingPage'));
// Module 9: Admin Panel
const AdminDashboardPage = lazy(() => import('./pages/AdminDashboardPage'));
const AdminUsersPage = lazy(() => import('./pages/AdminUsersPage'));
const AdminJobsPage = lazy(() => import('./pages/AdminJobsPage'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

function PageFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Spinner size={32} />
    </div>
  );
}

/** Public placeholder route: centered content over the mesh background. */
function PublicScreen({ name }: { name: string }) {
  return (
    <>
      <MeshBackground />
      <div className="flex min-h-screen items-center justify-center p-4">
        <Placeholder name={name} />
      </div>
    </>
  );
}

/** Wrap a real page in the protected app shell. */
function Protected({ children }: { children: ReactNode }) {
  return (
    <ProtectedRoute>
      <AppShell>
        <ErrorBoundary>{children}</ErrorBoundary>
      </AppShell>
    </ProtectedRoute>
  );
}

/** Wrap a real page in the admin-guarded app shell. */
function AdminOnly({ children }: { children: ReactNode }) {
  return (
    <AdminRoute>
      <AppShell>
        <ErrorBoundary>{children}</ErrorBoundary>
      </AppShell>
    </AdminRoute>
  );
}

function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>{children}</BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default function App() {
  return (
    <Providers>
      <ErrorBoundary>
        <Suspense fallback={<PageFallback />}>
          <Routes>
          {/* ---------- Public (self-contained: own MeshBackground) ---------- */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/s/:slug" element={<PublicClipPage />} />

          {/* ---------- Dashboard / Account ---------- */}
          <Route path="/" element={<Protected><DashboardPage /></Protected>} />
          <Route path="/dashboard" element={<Protected><DashboardPage /></Protected>} />
          <Route path="/profile" element={<Protected><ProfilePage /></Protected>} />
          <Route path="/settings" element={<Protected><SettingsPage /></Protected>} />

          {/* ---------- Projects / Uploads ---------- */}
          <Route path="/projects" element={<Protected><ProjectListPage /></Protected>} />
          <Route path="/projects/:id" element={<Protected><ProjectDetailPage /></Protected>} />
          <Route path="/projects/:id/upload" element={<Protected><UploadPage /></Protected>} />
          <Route path="/videos/:id" element={<Protected><SourceVideoPage /></Protected>} />

          {/* ---------- Clips ---------- */}
          <Route path="/videos/:id/clips" element={<Protected><ClipCandidatesPage /></Protected>} />
          <Route path="/clips/:id/edit" element={<Protected><ClipEditorPage /></Protected>} />
          <Route path="/clips/:id/export" element={<Protected><ClipExportPage /></Protected>} />

          {/* ---------- Library ---------- */}
          <Route path="/library" element={<Protected><LibraryPage /></Protected>} />
          <Route path="/library/search" element={<Protected><SearchResultsPage /></Protected>} />
          <Route path="/library/clips/:id" element={<Protected><LibraryClipPage /></Protected>} />

          {/* ---------- Brand Kit ---------- */}
          <Route path="/settings/brand" element={<Protected><BrandKitPage /></Protected>} />
          <Route path="/settings/brand/presets" element={<Protected><CaptionPresetPage /></Protected>} />

          {/* ---------- Connections ---------- */}
          <Route path="/settings/connections" element={<Protected><ConnectionsPage /></Protected>} />

          {/* ---------- Billing ---------- */}
          <Route path="/billing" element={<Protected><BillingPage /></Protected>} />

          {/* ---------- Publishing ---------- */}
          <Route path="/publish" element={<Protected><PublishQueuePage /></Protected>} />
          <Route path="/publish/calendar" element={<Protected><PublishCalendarPage /></Protected>} />
          <Route path="/clips/:id/publish" element={<Protected><PublishComposePage /></Protected>} />

          {/* ---------- Admin ---------- */}
          <Route path="/admin" element={<AdminOnly><AdminDashboardPage /></AdminOnly>} />
          <Route path="/admin/users" element={<AdminOnly><AdminUsersPage /></AdminOnly>} />
          <Route path="/admin/jobs" element={<AdminOnly><AdminJobsPage /></AdminOnly>} />

            {/* ---------- Fallback ---------- */}
            <Route path="*" element={<PublicScreen name="NotFoundPage" />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </Providers>
  );
}

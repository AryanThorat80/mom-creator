import { useState, useEffect } from 'react';

import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import {
  WorkspaceProvider,
  useWorkspace,
} from './context/WorkspaceContext.jsx';

import { WorkspaceInvitationPage } from './pages/WorkspaceInvitationPage.jsx';

import { ToastProvider } from './context/ToastContext.jsx';
import { AppLayout } from './components/layout/AppLayout.jsx';

import { LoginPage } from './pages/LoginPage.jsx';
import { RegisterPage } from './pages/RegisterPage.jsx';
import { DashboardPage } from './pages/DashboardPage.jsx';
import { MeetingsPage } from './pages/MeetingsPage.jsx';
import { MeetingDetailPage } from './pages/MeetingDetailPage.jsx';
import { WorkspacesPage } from './pages/WorkspacesPage.jsx';
import { MembersPage } from './pages/MembersPage.jsx';
import { IntegrationsPage } from './pages/IntegrationsPage.jsx';
import { GoogleCallbackPage } from './pages/GoogleCallbackPage.jsx';
import { HealthCheckPage } from './pages/HealthCheckPage.jsx';

import { CreateMeetingModal } from './components/meeting/CreateMeetingModal.jsx';

import PublicHomePage from './pages/PublicHomePage.jsx';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage.jsx';
import TermsOfServicePage from './pages/TermsOfServicePage.jsx';

function MainApp() {
  const { session, loading: authLoading } = useAuth();

  const [currentPath, setCurrentPath] = useState(
    () => window.location.pathname || '/dashboard'
  );

  const [createMeetingOpen, setCreateMeetingOpen] = useState(false);

  /*
   * Sync browser navigation
   */
  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(
        window.location.pathname || '/dashboard'
      );
    };

    window.addEventListener(
      'popstate',
      handlePopState
    );

    return () => {
      window.removeEventListener(
        'popstate',
        handlePopState
      );
    };
  }, []);

  /*
   * Central application navigation
   */
  const navigate = (path) => {
    if (!path) return;

    window.history.pushState({}, '', path);
    setCurrentPath(path);
  };

  /*
   * Authentication loading
   */
  if (authLoading) {
    return (
      <div className="min-h-screen w-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-brand-gradient text-white font-bold text-base flex items-center justify-center shadow-xs animate-pulse">
            M
          </div>

          <p className="text-xs font-medium text-slate-500">
            Loading MOM Creator...
          </p>
        </div>
      </div>
    );
  }

  /*
   * Public pages
   */
  if (currentPath === '/') {
    return <PublicHomePage />;
  }

  if (currentPath === '/privacy') {
    return <PrivacyPolicyPage />;
  }

  if (currentPath === '/terms') {
    return <TermsOfServicePage />;
  }

  /*
   * Google OAuth callback
   */
  if (currentPath.startsWith('/google-integration')) {
    return (
      <GoogleCallbackPage
        onNavigate={navigate}
      />
    );
  }

  /*
   * Workspace invitation
   *
   * This must remain before the authentication gate
   * because an unauthenticated invited user needs to
   * reach the invitation page.
   */
  if (currentPath.startsWith('/invitations/')) {
    const invitationToken =
      currentPath.split('/')[2];

    return (
      <WorkspaceInvitationPage
        token={invitationToken}
        onNavigate={navigate}
      />
    );
  }

  /*
   * Authentication gate
   */
  if (!session) {
    if (currentPath === '/register') {
      return (
        <RegisterPage
          onNavigateToLogin={() =>
            navigate('/login')
          }
        />
      );
    }

    return (
      <LoginPage
        onNavigateToRegister={() =>
          navigate('/register')
        }
      />
    );
  }

  /*
   * Breadcrumbs
   */
  const getBreadcrumbs = () => {
    if (currentPath === '/dashboard') {
      return [{ label: 'Dashboard' }];
    }

    if (currentPath === '/meetings') {
      return [{ label: 'Meetings' }];
    }

    if (currentPath.startsWith('/meetings/')) {
      return [
        {
          label: 'Meetings',
          onClick: () => navigate('/meetings'),
        },
        {
          label: 'Details',
        },
      ];
    }

    if (currentPath === '/workspaces') {
      return [{ label: 'Workspaces' }];
    }

    if (currentPath === '/members') {
      return [{ label: 'Members' }];
    }

    if (currentPath === '/integrations') {
      return [{ label: 'Integrations' }];
    }

    if (currentPath === '/settings') {
      return [{ label: 'API Diagnostics' }];
    }

    return [{ label: 'Dashboard' }];
  };

  /*
   * Render current page
   */
  let pageContent = null;

  if (currentPath.startsWith('/meetings/')) {
    const meetingId =
      currentPath.split('/')[2];

    pageContent = (
      <MeetingDetailPage
        meetingId={meetingId}
        onBack={() => navigate('/meetings')}
        onNavigate={navigate}
      />
    );

  } else if (currentPath === '/meetings') {

    pageContent = (
      <MeetingsPage
        onNavigate={navigate}
        onOpenCreateMeeting={() =>
          setCreateMeetingOpen(true)
        }
      />
    );

  } else if (currentPath === '/workspaces') {

    pageContent = (
      <WorkspacesPage
        onNavigate={navigate}
      />
    );

  } else if (currentPath === '/members') {

    pageContent = (
      <MembersPage
        onNavigate={navigate}
      />
    );

  } else if (currentPath === '/integrations') {

    pageContent = <IntegrationsPage />;

  } else if (currentPath === '/settings') {

    pageContent = <HealthCheckPage />;

  } else {

    pageContent = (
      <DashboardPage
        onNavigate={navigate}
        onOpenCreateMeeting={() =>
          setCreateMeetingOpen(true)
        }
      />
    );
  }

  return (
    <AppLayout
      currentPath={currentPath}
      onNavigate={navigate}
      breadcrumbs={getBreadcrumbs()}
      onOpenCreateMeeting={() =>
        setCreateMeetingOpen(true)
      }
    >
      {pageContent}

      {/* Global New Meeting Modal */}
      <CreateMeetingModal
        isOpen={createMeetingOpen}
        onClose={() =>
          setCreateMeetingOpen(false)
        }
        onMeetingCreated={(newMeeting) => {
          navigate(
            `/meetings/${newMeeting.id}`
          );
        }}
      />
    </AppLayout>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <WorkspaceProvider>
          <MainApp />
        </WorkspaceProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
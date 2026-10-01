import { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

import { acceptWorkspaceInvitation } from '../services/workspaces.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useWorkspace } from '../context/WorkspaceContext.jsx';
import { Button } from '../components/common/Button.jsx';

export function WorkspaceInvitationPage({ token, onNavigate }) {
  const { session, user } = useAuth();
  const { refreshWorkspaces } = useWorkspace();

  const [status, setStatus] = useState('checking');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!session) {
      setStatus('login_required');
      return;
    }

    let cancelled = false;

    const acceptInvitation = async () => {
      setStatus('accepting');
      setMessage('');

      try {
        const result = await acceptWorkspaceInvitation(token);

        if (cancelled) return;

        await refreshWorkspaces(result.workspace_id);

        if (cancelled) return;

        setMessage(
          result.message || 'You have joined the workspace successfully.'
        );
        setStatus('success');
      } catch (err) {
        if (cancelled) return;

        console.error('Failed to accept workspace invitation:', err);

        setMessage(
          err.message || 'This invitation could not be accepted.'
        );
        setStatus('error');
      }
    };

    acceptInvitation();

    return () => {
      cancelled = true;
    };
  }, [session, token, refreshWorkspaces]);

  const handleLogin = () => {
    onNavigate('/login');
  };

  const handleRegister = () => {
    onNavigate('/register');
  };

  const handleDashboard = () => {
    onNavigate('/dashboard');
  };

  if (status === 'checking') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-brand-gradient animate-spin mx-auto" />

          <p className="mt-4 text-sm font-semibold text-slate-800">
            Checking invitation...
          </p>

          <p className="mt-1 text-xs text-slate-500">
            Please wait.
          </p>
        </div>
      </div>
    );
  }

  if (status === 'login_required') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-indigo-50 text-brand-gradient flex items-center justify-center mx-auto">
              <AlertCircle className="w-6 h-6" />
            </div>

            <h1 className="mt-5 text-xl font-bold text-slate-900">
              You have been invited
            </h1>

            <p className="mt-2 text-sm text-slate-500 leading-relaxed">
              Log in or create an account using the email address that
              received this invitation.
            </p>

            <div className="mt-6 space-y-3">
              <Button
                type="button"
                className="w-full"
                onClick={handleLogin}
              >
                Log In
              </Button>

              <Button
                type="button"
                variant="secondary"
                className="w-full"
                onClick={handleRegister}
              >
                Create Account
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (status === 'accepting') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="text-center">
          <Loader2 className="w-8 h-8 text-brand-gradient animate-spin mx-auto" />

          <p className="mt-4 text-sm font-semibold text-slate-800">
            Joining workspace...
          </p>

          <p className="mt-1 text-xs text-slate-500">
            Adding you as a workspace member.
          </p>
        </div>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>

            <h1 className="mt-5 text-xl font-bold text-slate-900">
              Invitation accepted
            </h1>

            <p className="mt-2 text-sm text-slate-500 leading-relaxed">
              {message}
            </p>

            {user?.email && (
              <p className="mt-3 text-xs text-slate-400">
                Signed in as {user.email}
              </p>
            )}

            <Button
              type="button"
              className="w-full mt-6"
              onClick={handleDashboard}
            >
              Go to Dashboard
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-7 h-7" />
          </div>

          <h1 className="mt-5 text-xl font-bold text-slate-900">
            Invitation could not be accepted
          </h1>

          <p className="mt-2 text-sm text-slate-500 leading-relaxed">
            {message}
          </p>

          <Button
            type="button"
            variant="secondary"
            className="w-full mt-6"
            onClick={handleDashboard}
          >
            Go to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
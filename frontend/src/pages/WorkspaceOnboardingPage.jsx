import { useState } from 'react';
import { Building2, ArrowRight } from 'lucide-react';
import { useWorkspace } from '../context/WorkspaceContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { Input } from '../components/common/Input.jsx';
import { Button } from '../components/common/Button.jsx';

export function WorkspaceOnboardingPage({ onComplete }) {
  const { createWorkspace } = useWorkspace();
  const { profile, user } = useAuth();
  const { showToast } = useToast();

  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();

    const workspaceName = name.trim();

    if (!workspaceName) {
      setError('Workspace name is required');
      return;
    }

    if (workspaceName.length > 150) {
      setError('Workspace name must be 150 characters or less');
      return;
    }

    setLoading(true);
    setError('');

    try {
      await createWorkspace({
        name: workspaceName,
        terminology: {},
      });

      showToast('Workspace created successfully', 'success');

      onComplete();
    } catch (err) {
      console.error('Failed to create workspace:', err);
      setError(err.message || 'Failed to create workspace');
    } finally {
      setLoading(false);
    }
  };

  const displayName =
    profile?.full_name ||
    profile?.name ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    '';

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg">
        {/* Logo / Brand */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-11 h-11 rounded-xl bg-brand-gradient text-white font-bold text-lg flex items-center justify-center shadow-sm mb-4">
            M
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Create your workspace
          </h1>

          <p className="text-sm text-slate-500 mt-2 text-center max-w-md">
            {displayName
              ? `Welcome, ${displayName}. Let's set up your workspace before you start creating meetings.`
              : "Let's set up your workspace before you start creating meetings."}
          </p>
        </div>

        {/* Card */}
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm p-6 sm:p-8">
          <div className="flex items-start gap-4 mb-7">
            <div className="w-10 h-10 shrink-0 rounded-xl bg-indigo-50 text-brand-gradient flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>

            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Your first workspace
              </h2>

              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Workspaces organize your meetings, MOMs, transcripts, and
                action items.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <Input
              label="Workspace Name"
              placeholder="e.g. Engineering Team"
              value={name}
              onChange={(e) => {
                setName(e.target.value);

                if (error) {
                  setError('');
                }
              }}
              error={error}
              autoFocus
              required
            />

            <Button
              type="submit"
              className="w-full"
              loading={loading}
              icon={ArrowRight}
            >
              Create Workspace
            </Button>
          </form>
        </div>

        <p className="text-[11px] text-slate-400 text-center mt-5">
          You can create additional workspaces later from Workspace Settings.
        </p>
      </div>
    </div>
  );
}
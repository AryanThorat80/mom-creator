import { useEffect, useState } from 'react';
import {
  Users,
  UserPlus,
  Copy,
  Check,
  Loader2,
  Shield,
  Mail,
} from 'lucide-react';

import {
  getWorkspaceMembers,
  createWorkspaceInvitation,
} from '../../services/workspaces.js';

import { useWorkspace } from '../../context/WorkspaceContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { Button } from '../common/Button.jsx';
import { Input } from '../common/Input.jsx';

export function WorkspaceMembers() {
  const { currentWorkspace } = useWorkspace();
  const { showToast } = useToast();

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [inviting, setInviting] = useState(false);

  const [invitationUrl, setInvitationUrl] = useState('');
  const [copied, setCopied] = useState(false);

  const loadMembers = async () => {
    if (!currentWorkspace?.id) return;

    setLoading(true);

    try {
      const data = await getWorkspaceMembers(currentWorkspace.id);

      setMembers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Failed to load workspace members:', err);

      showToast(
        err.message || 'Failed to load workspace members',
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMembers();
  }, [currentWorkspace?.id]);

  const handleInvite = async (e) => {
    e.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      return;
    }

    setInviting(true);
    setInvitationUrl('');
    setCopied(false);

    try {
      const result = await createWorkspaceInvitation(
        currentWorkspace.id,
        normalizedEmail
      );

      setInvitationUrl(result.invitation_url);

      showToast(
        'Invitation created successfully',
        'success'
      );

      setEmail('');
    } catch (err) {
      console.error('Failed to create invitation:', err);

      showToast(
        err.message || 'Failed to create invitation',
        'error'
      );
    } finally {
      setInviting(false);
    }
  };

  const handleCopy = async () => {
    if (!invitationUrl) return;

    try {
      await navigator.clipboard.writeText(invitationUrl);

      setCopied(true);

      showToast('Invitation link copied', 'success');

      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy invitation link:', err);

      showToast(
        'Could not copy the invitation link',
        'error'
      );
    }
  };

  if (!currentWorkspace) {
    return null;
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">

        <div>
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-slate-600" />

            <h2 className="text-base font-semibold text-slate-900">
              Workspace Members
            </h2>
          </div>

          <p className="text-xs text-slate-500 mt-1">
            People who can access this workspace.
          </p>
        </div>

        <Button
          type="button"
          size="sm"
          icon={UserPlus}
          onClick={() => {
            setInviteOpen((value) => !value);
            setInvitationUrl('');
            setCopied(false);
          }}
        >
          Invite Member
        </Button>

      </div>

      {/* Invite form */}
      {inviteOpen && (
        <div className="border border-indigo-100 bg-indigo-50/40 rounded-xl p-4">

          <div className="flex items-start gap-3 mb-4">

            <div className="w-9 h-9 rounded-lg bg-white border border-indigo-100 text-brand-gradient flex items-center justify-center">
              <Mail className="w-4 h-4" />
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                Invite someone to this workspace
              </h3>

              <p className="text-xs text-slate-500 mt-1">
                They must sign in using this email address to accept
                the invitation.
              </p>
            </div>

          </div>

          <form
            onSubmit={handleInvite}
            className="flex flex-col sm:flex-row gap-3"
          >

            <div className="flex-1">
              <Input
                type="email"
                label="Email address"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="sm:pt-6">
              <Button
                type="submit"
                loading={inviting}
                icon={UserPlus}
              >
                Create Invitation
              </Button>
            </div>

          </form>

          {/* Generated invitation */}
          {invitationUrl && (
            <div className="mt-4 border border-emerald-200 bg-emerald-50 rounded-xl p-4">

              <div className="flex items-start gap-3">

                <div className="w-8 h-8 rounded-lg bg-white text-emerald-600 flex items-center justify-center shrink-0">
                  <Check className="w-4 h-4" />
                </div>

                <div className="min-w-0 flex-1">

                  <p className="text-sm font-semibold text-emerald-900">
                    Invitation created
                  </p>

                  <p className="text-xs text-emerald-700 mt-1">
                    Send this link to the invited person.
                  </p>

                  <div className="mt-3 flex flex-col sm:flex-row gap-2">

                    <input
                      type="text"
                      value={invitationUrl}
                      readOnly
                      className="flex-1 min-w-0 px-3 py-2 text-xs bg-white border border-emerald-200 rounded-lg text-slate-600 outline-none"
                    />

                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      icon={copied ? Check : Copy}
                      onClick={handleCopy}
                    >
                      {copied ? 'Copied' : 'Copy Link'}
                    </Button>

                  </div>

                  <p className="text-[11px] text-emerald-700 mt-2">
                    This invitation expires after 7 days.
                  </p>

                </div>

              </div>

            </div>
          )}

        </div>
      )}

      {/* Members list */}
      <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">

        {loading ? (
          <div className="flex items-center justify-center py-12">

            <Loader2 className="w-5 h-5 text-brand-gradient animate-spin" />

            <span className="ml-2 text-xs text-slate-500">
              Loading members...
            </span>

          </div>
        ) : members.length === 0 ? (
          <div className="py-12 text-center">

            <Users className="w-8 h-8 text-slate-300 mx-auto" />

            <p className="mt-3 text-sm font-medium text-slate-700">
              No members found
            </p>

          </div>
        ) : (
          <div className="divide-y divide-slate-100">

            {members.map((member) => (

              <div
                key={member.user_id}
                className="flex items-center justify-between gap-4 px-4 py-4"
              >

                <div className="flex items-center gap-3 min-w-0">

                  <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-xs font-semibold text-slate-600 shrink-0">
                    {(member.name || '?')
                      .charAt(0)
                      .toUpperCase()}
                  </div>

                  <div className="min-w-0">

                    <p className="text-sm font-medium text-slate-900 truncate">
                      {member.name || 'Unnamed member'}
                    </p>

                    <p className="text-[11px] text-slate-500 font-mono truncate">
                      {member.user_id}
                    </p>

                  </div>

                </div>

                <div className="shrink-0">

                  {member.role === 'owner' ? (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 text-[11px] font-semibold">

                      <Shield className="w-3 h-3" />

                      Owner

                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[11px] font-semibold">
                      Member
                    </span>
                  )}

                </div>

              </div>

            ))}

          </div>
        )}

      </div>

    </div>
  );
}
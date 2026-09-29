import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Crown,
  Mail,
  RefreshCw,
  Shield,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';

import { Button } from '../components/common/Button.jsx';
import { Input } from '../components/common/Input.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useWorkspace } from '../context/WorkspaceContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import {
  createWorkspaceInvitation,
  getWorkspaceMembers,
  removeWorkspaceMember,
} from '../services/workspaces.js';

export function MembersPage({ onNavigate }) {
  const { currentWorkspace } = useWorkspace();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [removingUserId, setRemovingUserId] = useState(null);

  const loadMembers = useCallback(
    async (silent = false) => {
      if (!currentWorkspace?.id) return;

      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      try {
        const data = await getWorkspaceMembers(currentWorkspace.id);
        setMembers(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Failed to load workspace members:', err);
        showToast(err.message || 'Failed to load members', 'error');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [currentWorkspace?.id, showToast]
  );

  useEffect(() => {
    loadMembers();
  }, [loadMembers]);

  const currentMembership = useMemo(
    () => members.find((member) => member.user_id === user?.id),
    [members, user?.id]
  );

  const isOwner = currentMembership?.role === 'owner';

  const handleInvite = async (event) => {
    event.preventDefault();

    const email = inviteEmail.trim().toLowerCase();

    if (!email) {
      showToast('Enter an email address', 'error');
      return;
    }

    setInviting(true);

    try {
      await createWorkspaceInvitation(currentWorkspace.id, email);
      showToast(`Invitation sent to ${email}`, 'success');
      setInviteEmail('');
      setInviteOpen(false);
    } catch (err) {
      console.error('Failed to invite member:', err);
      showToast(err.message || 'Failed to send invitation', 'error');
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (member) => {
    if (!isOwner || member.role === 'owner') return;

    const confirmed = window.confirm(
      `Remove ${member.name || 'this member'} from the workspace?`
    );

    if (!confirmed) return;

    setRemovingUserId(member.user_id);

    try {
      await removeWorkspaceMember(
        currentWorkspace.id,
        member.user_id
      );

      showToast('Member removed', 'success');
      await loadMembers(true);
    } catch (err) {
      console.error('Failed to remove member:', err);
      showToast(err.message || 'Failed to remove member', 'error');
    } finally {
      setRemovingUserId(null);
    }
  };

  if (!currentWorkspace) {
    return (
      <div className="max-w-4xl mx-auto p-8 text-center">
        <p className="text-sm text-slate-500">
          No workspace selected.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-8 space-y-7">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => onNavigate?.('/workspaces')}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            Back to Workspaces
          </button>

          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>

            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Members
              </h1>
              <p className="text-sm text-slate-500 mt-0.5">
                Manage people in {currentWorkspace.name}.
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => loadMembers(true)}
          disabled={refreshing}
          title="Refresh members"
          className="p-2 rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-900 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw
            className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`}
          />
        </button>
      </div>

      {isOwner && (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Invite a member
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                An invitation email will be sent with a secure join link.
              </p>
            </div>

            {!inviteOpen && (
              <Button
                size="sm"
                icon={UserPlus}
                onClick={() => setInviteOpen(true)}
              >
                Invite Member
              </Button>
            )}
          </div>

          {inviteOpen && (
            <form
              onSubmit={handleInvite}
              className="p-5 bg-slate-50/70"
            >
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <Input
                    label="Email address"
                    type="email"
                    placeholder="person@example.com"
                    value={inviteEmail}
                    onChange={(event) => setInviteEmail(event.target.value)}
                    autoFocus
                    required
                  />
                </div>

                <div className="flex items-end gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => {
                      setInviteOpen(false);
                      setInviteEmail('');
                    }}
                  >
                    Cancel
                  </Button>

                  <Button
                    type="submit"
                    loading={inviting}
                    icon={Mail}
                  >
                    Send Invite
                  </Button>
                </div>
              </div>
            </form>
          )}
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Workspace members
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                {members.length} {members.length === 1 ? 'member' : 'members'}
              </p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="p-6 space-y-4">
            {[1, 2].map((item) => (
              <div
                key={item}
                className="h-16 rounded-xl bg-slate-100 animate-pulse"
              />
            ))}
          </div>
        ) : members.length === 0 ? (
          <div className="p-10 text-center">
            <Users className="w-8 h-8 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-700">
              No members found
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {members.map((member) => {
              const isCurrentUser = member.user_id === user?.id;
              const isMemberOwner = member.role === 'owner';

              return (
                <div
                  key={member.user_id}
                  className="px-5 py-4 flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                        isMemberOwner
                          ? 'bg-amber-50 text-amber-600'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {isMemberOwner ? (
                        <Crown className="w-4 h-4" />
                      ) : (
                        <Users className="w-4 h-4" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {member.name || 'Unnamed member'}
                        </p>

                        {isCurrentUser && (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600">
                            You
                          </span>
                        )}
                      </div>

                      <p className="text-xs text-slate-500 mt-0.5 font-mono truncate">
                        {member.user_id}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                        isMemberOwner
                          ? 'bg-amber-50 text-amber-700'
                          : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {isMemberOwner ? (
                        <Crown className="w-3 h-3" />
                      ) : (
                        <Shield className="w-3 h-3" />
                      )}
                      {isMemberOwner ? 'Owner' : 'Member'}
                    </span>

                    {isOwner && !isMemberOwner && (
                      <button
                        type="button"
                        onClick={() => handleRemove(member)}
                        disabled={removingUserId === member.user_id}
                        title="Remove member"
                        className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-50 transition-colors"
                      >
                        <Trash2
                          className={`w-4 h-4 ${
                            removingUserId === member.user_id
                              ? 'animate-pulse'
                              : ''
                          }`}
                        />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {!isOwner && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs text-slate-500">
            You can view workspace members, but only the workspace owner can
            invite or remove members.
          </p>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Modal } from '../common/Modal.jsx';
import { Input } from '../common/Input.jsx';
import { Button } from '../common/Button.jsx';
import { useWorkspace } from '../../context/WorkspaceContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { updateWorkspace, getWorkspaceMembers } from '../../services/workspaces.js';
import { Users, Shield } from 'lucide-react';

export function WorkspaceSettingsModal({ isOpen, onClose }) {
  const { currentWorkspace, refreshWorkspaces } = useWorkspace();
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [members, setMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && currentWorkspace) {
      setName(currentWorkspace.name || '');
      setError('');
      loadMembers(currentWorkspace.id);
    }
  }, [isOpen, currentWorkspace]);

  const loadMembers = async (wsId) => {
    setLoadingMembers(true);
    try {
      const data = await getWorkspaceMembers(wsId);
      setMembers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn('Failed to load workspace members:', err);
    } finally {
      setLoadingMembers(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Workspace name cannot be empty');
      return;
    }

    setSaving(true);
    setError('');
    try {
      await updateWorkspace(currentWorkspace.id, { name: name.trim() });
      await refreshWorkspaces(currentWorkspace.id);
      showToast('Workspace settings updated', 'success');
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to update workspace');
    } finally {
      setSaving(false);
    }
  };

  if (!currentWorkspace) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Workspace Settings"
      description={`Manage settings for "${currentWorkspace.name}"`}
      maxWidth="max-w-xl"
    >
      <form onSubmit={handleSave} className="space-y-6">
        <div className="space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">General</h3>
          <Input
            label="Workspace Name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError('');
            }}
            required
            error={error}
          />
        </div>

        <div className="space-y-3 pt-3 border-t border-slate-100">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" />
              <span>Workspace Members ({members.length})</span>
            </h3>
          </div>

          {loadingMembers ? (
            <div className="text-xs text-slate-400 py-3 text-center">Loading members...</div>
          ) : members.length > 0 ? (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden bg-slate-50/50">
              {members.map((m, idx) => (
                <div key={m.user_id || idx} className="flex items-center justify-between px-3.5 py-2.5 text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-700 flex items-center justify-center font-semibold text-[11px]">
                      {m.role?.[0]?.toUpperCase() || 'M'}
                    </div>
                    <div>
                      <span className="font-mono text-slate-700">{m.user_id ? `${m.user_id.slice(0, 8)}...` : 'User'}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-500 font-medium capitalize">
                    <Shield className="w-3 h-3 text-slate-400" />
                    <span>{m.role || 'member'}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500 italic">No member records returned.</p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="submit" size="sm" loading={saving}>
            Save Changes
          </Button>
        </div>
      </form>
    </Modal>
  );
}

import { useState, useEffect } from 'react';
import { Modal } from '../common/Modal.jsx';
import { Input } from '../common/Input.jsx';
import { Button } from '../common/Button.jsx';
import { useWorkspace } from '../../context/WorkspaceContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { updateWorkspace, getWorkspaceMembers } from '../../services/workspaces.js';
import {
  Users,
  Shield,
  FileText,
  Upload,
  Trash2,
  RefreshCw,
} from 'lucide-react';

import {
  getMOMTemplate,
  uploadMOMTemplate,
  deleteMOMTemplate,
} from '../../services/momTemplates.js';

export function WorkspaceSettingsModal({ isOpen, onClose }) {
  const { currentWorkspace, refreshWorkspaces } = useWorkspace();
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [members, setMembers] = useState([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [momTemplate, setMomTemplate] = useState(null);
  const [loadingTemplate, setLoadingTemplate] = useState(false);
  const [uploadingTemplate, setUploadingTemplate] = useState(false);
  const [deletingTemplate, setDeletingTemplate] = useState(false);

  useEffect(() => {
    if (isOpen && currentWorkspace) {
      setName(currentWorkspace.name || '');
      setError('');
      loadMembers(currentWorkspace.id);
      loadMOMTemplate(currentWorkspace.id);
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
  const loadMOMTemplate = async (workspaceId) => {
    setLoadingTemplate(true);

    try {
      const data = await getMOMTemplate(workspaceId);
      setMomTemplate(data || null);
    } catch (err) {
      console.warn('Failed to load MOM template:', err);
      setMomTemplate(null);
    } finally {
      setLoadingTemplate(false);
    }
  };

  const handleMOMTemplateUpload = async (event) => {
    const file = event.target.files?.[0];

    event.target.value = '';

    if (!file) return;

    setUploadingTemplate(true);

    try {
      const result = await uploadMOMTemplate(
        currentWorkspace.id,
        file
      );

      setMomTemplate(result);

      showToast(
        'MOM template/example uploaded successfully',
        'success'
      );
    } catch (err) {
      console.error('Failed to upload MOM template:', err);

      showToast(
        err.message || 'Failed to upload MOM template',
        'error'
      );
    } finally {
      setUploadingTemplate(false);
    }
  };

  const handleMOMTemplateDelete = async () => {
    if (!window.confirm(
      'Delete the workspace MOM template/example?'
    )) {
      return;
    }

    setDeletingTemplate(true);

    try {
      await deleteMOMTemplate(currentWorkspace.id);

      setMomTemplate(null);

      showToast(
        'MOM template/example deleted',
        'success'
      );
    } catch (err) {
      console.error('Failed to delete MOM template:', err);

      showToast(
        err.message || 'Failed to delete MOM template',
        'error'
      );
    } finally {
      setDeletingTemplate(false);
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
        <div className="space-y-4 pt-3 border-t border-slate-100">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              MOM Template / Example
            </h3>

            <p className="text-xs text-slate-500 mt-1">
              Upload a template or completed MOM example. It will be
              used as a reference when generating new MOMs.
            </p>
          </div>

          {loadingTemplate ? (
            <div className="text-xs text-slate-400 py-3 text-center">
              Loading MOM template...
            </div>
          ) : momTemplate ? (
            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-9 h-9 shrink-0 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                    <FileText className="w-4 h-4" />
                  </div>

                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">
                      {momTemplate.file_name}
                    </p>

                    <p className="text-[11px] text-slate-500 mt-0.5">
                      {momTemplate.source_type === 'example'
                        ? 'Completed MOM example'
                        : 'MOM template'}
                      {momTemplate.file_size
                        ? ` • ${(momTemplate.file_size / 1024 / 1024).toFixed(2)} MB`
                        : ''}
                    </p>
                  </div>
                </div>

                <span className="text-[10px] font-semibold uppercase px-2 py-1 rounded bg-emerald-50 text-emerald-700">
                  Active
                </span>
              </div>

              <div className="flex items-center gap-2 mt-4">
                <label className="flex-1">
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.doc,.docx"
                    onChange={handleMOMTemplateUpload}
                    disabled={uploadingTemplate}
                  />

                  <span className="inline-flex items-center justify-center gap-2 w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer">
                    <RefreshCw className="w-3.5 h-3.5" />
                    {uploadingTemplate ? 'Uploading...' : 'Replace'}
                  </span>
                </label>

                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleMOMTemplateDelete}
                  disabled={deletingTemplate || uploadingTemplate}
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                </Button>
              </div>
            </div>
          ) : (
            <label>
              <input
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx"
                onChange={handleMOMTemplateUpload}
                disabled={uploadingTemplate}
              />

              <div className="border-2 border-dashed border-slate-200 rounded-xl p-6 text-center hover:border-indigo-300 hover:bg-indigo-50/30 transition-colors cursor-pointer">
                <Upload className="w-6 h-6 text-slate-400 mx-auto" />

                <p className="text-sm font-semibold text-slate-700 mt-2">
                  {uploadingTemplate
                    ? 'Uploading...'
                    : 'Upload MOM template or example'}
                </p>

                <p className="text-[11px] text-slate-400 mt-1">
                  PDF, DOC, or DOCX • Maximum 10 MB
                </p>
              </div>
            </label>
          )}
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

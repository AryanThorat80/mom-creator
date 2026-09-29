import { useState } from 'react';
import { Modal } from '../common/Modal.jsx';
import { Input } from '../common/Input.jsx';
import { Button } from '../common/Button.jsx';
import { useWorkspace } from '../../context/WorkspaceContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';

export function CreateWorkspaceModal({ isOpen, onClose }) {
  const { createWorkspace } = useWorkspace();
  const { showToast } = useToast();
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Workspace name is required');
      return;
    }
    if (name.trim().length > 150) {
      setError('Workspace name must be 150 characters or less');
      return;
    }

    setLoading(true);
    setError('');
    try {
      await createWorkspace({ name: name.trim(), terminology: {} });
      showToast('Workspace created successfully', 'success');
      setName('');
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to create workspace');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Create Workspace"
      description="Workspaces organize your meetings, MOMs, and action items."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Workspace Name"
          placeholder="e.g. Engineering Team or Marketing Launch"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (error) setError('');
          }}
          required
          autoFocus
          error={error}
        />
        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" size="sm" loading={loading}>
            Create Workspace
          </Button>
        </div>
      </form>
    </Modal>
  );
}

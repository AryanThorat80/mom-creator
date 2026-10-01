import { useState, useEffect } from 'react';
import { Modal } from '../common/Modal.jsx';
import { Input } from '../common/Input.jsx';
import { Select } from '../common/Select.jsx';
import { Button } from '../common/Button.jsx';
import { useWorkspace } from '../../context/WorkspaceContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { createActionItem, updateActionItem } from '../../services/actionItems.js';
import { getWorkspaceMembers } from '../../services/workspaces.js';

export function ActionItemModal({
  isOpen,
  onClose,
  meetingId,
  actionItem = null,
  onSaved,
}) {
  const { currentWorkspace } = useWorkspace();
  const { showToast } = useToast();

  const isEdit = Boolean(actionItem?.id);

  const [task, setTask] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [assignedName, setAssignedName] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [status, setStatus] = useState('pending');
  const [priority, setPriority] = useState('medium');

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (currentWorkspace?.id) {
        getWorkspaceMembers(currentWorkspace.id)
          .then((data) => setMembers(Array.isArray(data) ? data : []))
          .catch(() => {});
      }

      if (actionItem) {
        setTask(actionItem.task || '');
        setAssignedTo(actionItem.assigned_to || '');
        setAssignedName(actionItem.assigned_name || '');
        setDueDate(actionItem.due_date ? actionItem.due_date.substring(0, 10) : '');
        setStatus(actionItem.status || 'pending');
        setPriority(actionItem.priority || 'medium');
      } else {
        setTask('');
        setAssignedTo('');
        setAssignedName('');
        setDueDate('');
        setStatus('pending');
        setPriority('medium');
      }
      setError('');
    }
  }, [isOpen, actionItem, currentWorkspace]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!task.trim()) {
      setError('Task description is required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      let isoDueDate = null;
      if (dueDate) {
        // Convert selected local date to local 18:00 timezone-aware ISO string
        const localDate = new Date(`${dueDate}T18:00:00`);
        isoDueDate = isNaN(localDate.getTime()) ? null : localDate.toISOString();
      }

      const payload = {
        task: task.trim(),
        assigned_to: assignedTo.trim() || null,
        assigned_name: assignedName.trim() || null,
        due_date: isoDueDate,
        status,
        priority,
      };

      let result;
      if (isEdit) {
        result = await updateActionItem(meetingId, actionItem.id, payload);
        showToast('Action item updated', 'success');
      } else {
        result = await createActionItem(meetingId, payload);
        showToast('Action item created', 'success');
      }

      if (onSaved) {
        onSaved(result || payload);
      }
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to save action item');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? 'Edit Action Item' : 'New Action Item'}
      description="Track ownership, due dates, and priorities."
      maxWidth="max-w-md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Task Description"
          placeholder="e.g. Finalize customer onboarding checklist"
          value={task}
          onChange={(e) => {
            setTask(e.target.value);
            if (error) setError('');
          }}
          required
          autoFocus
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="Assignee Name"
            placeholder="e.g. Priya or Alex"
            value={assignedName}
            onChange={(e) => setAssignedName(e.target.value)}
          />

          <Input
            type="date"
            label="Due Date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select
            label="Priority"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            options={[
              { value: 'low', label: 'Low' },
              { value: 'medium', label: 'Medium' },
              { value: 'high', label: 'High' },
              { value: 'urgent', label: 'Urgent' },
            ]}
          />

          <Select
            label="Status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            options={[
              { value: 'pending', label: 'Pending' },
              { value: 'in_progress', label: 'In Progress' },
              { value: 'completed', label: 'Completed' },
              { value: 'cancelled', label: 'Cancelled' },
            ]}
          />
        </div>

        {members.length > 0 && (
          <div>
            <label className="block text-[11px] font-semibold text-slate-500 mb-1">
              Link Workspace Member (Optional)
            </label>
            <select
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-brand-gradient"
            >
              <option value="">None (Unlinked)</option>
              {members.map((m) => (
                <option key={m.user_id} value={m.user_id}>
                  {m.user_id.slice(0, 8)}... ({m.role})
                </option>
              ))}
            </select>
          </div>
        )}

        {error && (
          <p className="text-xs text-rose-600 font-medium bg-rose-50 p-2.5 rounded-lg border border-rose-200">
            {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
          <Button variant="secondary" size="sm" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button type="submit" size="sm" loading={loading}>
            {isEdit ? 'Save Changes' : 'Create Item'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

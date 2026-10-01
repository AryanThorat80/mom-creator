import { useState } from 'react';
import { Plus, Trash2, Pencil, Users, Check, X } from 'lucide-react';
import { Button } from '../common/Button.jsx';
import { Input } from '../common/Input.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import {
  createMeetingParticipant,
  updateMeetingParticipant,
  deleteMeetingParticipant,
} from '../../services/meetingParticipants.js';

export function MeetingParticipants({ meetingId, participants = [], canEdit = false, onReload }) {
  const { showToast } = useToast();
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', role: '' });

  const resetForm = () => {
    setEditingId(null);
    setShowForm(false);
    setForm({ name: '', email: '', role: '' });
  };

  const startEdit = (participant) => {
    setEditingId(participant.id);
    setShowForm(true);
    setForm({ name: participant.name || '', email: participant.email || '', role: participant.role || '' });
  };

  const openCreate = () => {
    setEditingId(null);
    setShowForm(true);
    setForm({ name: '', email: '', role: '' });
  };

  const save = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) {
      showToast('Participant name is required', 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = { name: form.name.trim(), email: form.email.trim() || null, role: form.role.trim() || null };
      if (editingId) {
        await updateMeetingParticipant(meetingId, editingId, payload);
        showToast('Participant updated', 'success');
      } else {
        await createMeetingParticipant(meetingId, payload);
        showToast('Participant added', 'success');
      }
      resetForm();
      await onReload?.();
    } catch (err) {
      showToast(err.message || 'Failed to save participant', 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (participant) => {
    if (!window.confirm(`Remove ${participant.name}?`)) return;
    try {
      await deleteMeetingParticipant(meetingId, participant.id);
      showToast('Participant removed', 'success');
      await onReload?.();
    } catch (err) {
      showToast(err.message || 'Failed to remove participant', 'error');
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-brand-gradient" />
            <h3 className="text-sm font-bold text-slate-900">Participants</h3>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Add the meeting participants. Names, emails and roles are exported only when the selected template/example contains a participant section.
          </p>
        </div>
        {canEdit && !editingId && (
          <Button size="sm" variant="secondary" icon={Plus} onClick={openCreate}>Add Participant</Button>
        )}
      </div>

      {canEdit && showForm && (
        <form onSubmit={save} className="p-5 border-b border-slate-100 bg-slate-50/60">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Input label="Name" value={form.name} onChange={(e) => setForm((v) => ({ ...v, name: e.target.value }))} placeholder="Participant name" />
            <Input label="Email" type="email" value={form.email} onChange={(e) => setForm((v) => ({ ...v, email: e.target.value }))} placeholder="Optional" />
            <Input label="Role" value={form.role} onChange={(e) => setForm((v) => ({ ...v, role: e.target.value }))} placeholder="Optional" />
          </div>
          <div className="flex justify-end gap-2 mt-3">
            {editingId && <Button type="button" size="sm" variant="secondary" onClick={resetForm} icon={X}>Cancel</Button>}
            <Button type="submit" size="sm" loading={saving} icon={editingId ? Check : Plus}>{editingId ? 'Save Participant' : 'Add Participant'}</Button>
          </div>
        </form>
      )}

      <div className="divide-y divide-slate-100">
        {participants.length === 0 ? (
          <div className="px-5 py-8 text-center text-xs text-slate-500">No participants added yet.</div>
        ) : (
          participants.map((participant) => (
            <div key={participant.id} className="px-5 py-3 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-900">{participant.name}</div>
                <div className="text-xs text-slate-500 mt-0.5">{[participant.role, participant.email].filter(Boolean).join(' · ') || 'No additional details'}</div>
              </div>
              {canEdit && (
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => startEdit(participant)} className="p-2 rounded-lg text-slate-400 hover:text-brand-gradient hover:bg-indigo-50" title="Edit participant"><Pencil className="w-4 h-4" /></button>
                  <button type="button" onClick={() => remove(participant)} className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50" title="Remove participant"><Trash2 className="w-4 h-4" /></button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </section>
  );
}

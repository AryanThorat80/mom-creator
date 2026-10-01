import { useState } from 'react';
import {
  Calendar,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  Clock,
  ExternalLink,
  CalendarPlus,
  CalendarCheck,
  CalendarX,
  MoreHorizontal,
} from 'lucide-react';
import { Button } from '../common/Button.jsx';
import { ActionItemStatusBadge, PriorityBadge } from '../common/StatusBadge.jsx';
import { ActionItemModal } from './ActionItemModal.jsx';
import { AddToCalendarModal } from './AddToCalendarModal.jsx';
import { ConfirmDialog } from '../common/ConfirmDialog.jsx';
import { updateActionItem, deleteActionItem } from '../../services/actionItems.js';
import { deleteCalendarEvent } from '../../services/googleCalendar.js';
import { useToast } from '../../context/ToastContext.jsx';

export function ActionItemsTable({
  meetingId,
  actionItems = [],
  onReload,
  disabled = false,
}) {
  const { showToast } = useToast();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  const [calendarModalOpen, setCalendarModalOpen] = useState(false);
  const [calendarTargetItem, setCalendarTargetItem] = useState(null);

  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deletingItem, setDeletingItem] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const [removingCalendar, setRemovingCalendar] = useState(null);

  const formatDate = (dateStr) => {
    if (!dateStr) return 'No due date';
    try {
      const d = new Date(dateStr);
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
      }).format(d);
    } catch {
      return dateStr;
    }
  };

  const handleToggleStatus = async (item) => {
    if (disabled) return;
    const newStatus = item.status === 'completed' ? 'pending' : 'completed';
    try {
      await updateActionItem(meetingId, item.id, { status: newStatus });
      showToast(newStatus === 'completed' ? 'Task marked as completed' : 'Task reopened', 'success');
      if (onReload) onReload();
    } catch (err) {
      showToast(err.message || 'Failed to update task status', 'error');
    }
  };

  const handleDelete = async () => {
    if (!deletingItem) return;
    setDeleting(true);
    try {
      await deleteActionItem(meetingId, deletingItem.id);
      showToast('Action item deleted', 'success');
      setConfirmDeleteOpen(false);
      setDeletingItem(null);
      if (onReload) onReload();
    } catch (err) {
      showToast(err.message || 'Failed to delete action item', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleRemoveCalendarEvent = async (item) => {
    setRemovingCalendar(item.id);
    try {
      await deleteCalendarEvent(item.id);
      showToast('Removed event from Google Calendar', 'success');
      if (onReload) onReload();
    } catch (err) {
      showToast(err.message || 'Failed to delete Google Calendar event', 'error');
    } finally {
      setRemovingCalendar(null);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden space-y-0">
      {/* Header */}
      <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 bg-white">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 tracking-tight flex items-center gap-2">
            <span>Action Items</span>
            <span className="text-xs font-mono tabular-nums text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
              {actionItems.length}
            </span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Deliverables and tasks identified during the meeting.
          </p>
        </div>

        {!disabled && (
          <Button
            size="sm"
            onClick={() => {
              setEditingItem(null);
              setModalOpen(true);
            }}
            icon={Plus}
          >
            Add Action Item
          </Button>
        )}
      </div>

      {actionItems.length === 0 ? (
        <div className="p-8 text-center">
          <p className="text-xs text-slate-500">No action items yet.</p>
          {!disabled && (
            <div className="mt-3">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setEditingItem(null);
                  setModalOpen(true);
                }}
                icon={Plus}
              >
                Add first item
              </Button>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* Desktop Table View */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/75 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-2.5 px-4 w-10">Done</th>
                  <th className="py-2.5 px-4 min-w-50">Task</th>
                  <th className="py-2.5 px-4">Assignee</th>
                  <th className="py-2.5 px-4">Due Date</th>
                  <th className="py-2.5 px-4">Priority</th>
                  <th className="py-2.5 px-4">Calendar</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {actionItems.map((item) => {
                  const isCompleted = item.status === 'completed';
                  const hasCalendarEvent = Boolean(item.google_event_id);

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-50/75 transition-colors ${
                        isCompleted ? 'bg-slate-50/30' : ''
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          disabled={disabled}
                          onClick={() => handleToggleStatus(item)}
                          className={`w-4 h-4 rounded border flex items-center justify-center transition-colors cursor-pointer ${
                            isCompleted
                              ? 'bg-emerald-600 border-emerald-600 text-white'
                              : 'border-slate-300 hover:border-slate-400 bg-white'
                          }`}
                          aria-label={isCompleted ? 'Mark as pending' : 'Mark as complete'}
                        >
                          {isCompleted && <CheckCircle2 className="w-3.5 h-3.5" />}
                        </button>
                      </td>

                      {/* Task */}
                      <td className="py-3 px-4">
                        <span
                          className={`font-medium ${
                            isCompleted ? 'line-through text-slate-400' : 'text-slate-800'
                          }`}
                        >
                          {item.task}
                        </span>
                      </td>

                      {/* Assignee */}
                      <td className="py-3 px-4 text-slate-600">
                        {item.assigned_name ? (
                          <span className="font-medium text-slate-700">{item.assigned_name}</span>
                        ) : (
                          <span className="text-slate-400 italic">Unassigned</span>
                        )}
                      </td>

                      {/* Due Date */}
                      <td className="py-3 px-4 text-slate-600 font-mono tabular-nums">
                        {formatDate(item.due_date)}
                      </td>

                      {/* Priority */}
                      <td className="py-3 px-4">
                        <PriorityBadge priority={item.priority} />
                      </td>

                      {/* Calendar Integration */}
                      <td className="py-3 px-4">
                        {hasCalendarEvent ? (
                          <div className="flex items-center gap-1.5 text-xs text-indigo-700 font-medium">
                            <CalendarCheck className="w-3.5 h-3.5 text-brand-gradient shrink-0" />
                            <span>Scheduled</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveCalendarEvent(item)}
                              disabled={removingCalendar === item.id}
                              title="Remove event from Google Calendar"
                              className="text-slate-400 hover:text-rose-600 p-0.5 ml-1 transition-colors cursor-pointer"
                            >
                              <CalendarX className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setCalendarTargetItem(item);
                              setCalendarModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-brand-gradient transition-colors font-medium cursor-pointer"
                          >
                            <CalendarPlus className="w-3.5 h-3.5 text-slate-400" />
                            <span>Add to Calendar</span>
                          </button>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {!disabled && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingItem(item);
                                  setModalOpen(true);
                                }}
                                title="Edit item"
                                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setDeletingItem(item);
                                  setConfirmDeleteOpen(true);
                                }}
                                title="Delete item"
                                className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="sm:hidden divide-y divide-slate-100">
            {actionItems.map((item) => {
              const isCompleted = item.status === 'completed';
              const hasCalendarEvent = Boolean(item.google_event_id);

              return (
                <div key={item.id} className="p-4 space-y-3 bg-white">
                  <div className="flex items-start gap-3">
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => handleToggleStatus(item)}
                      className={`w-4 h-4 mt-0.5 rounded border flex items-center justify-center transition-colors shrink-0 ${
                        isCompleted
                          ? 'bg-emerald-600 border-emerald-600 text-white'
                          : 'border-slate-300 bg-white'
                      }`}
                    >
                      {isCompleted && <CheckCircle2 className="w-3.5 h-3.5" />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`text-xs font-medium leading-snug ${
                          isCompleted ? 'line-through text-slate-400' : 'text-slate-900'
                        }`}
                      >
                        {item.task}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[11px] text-slate-500">
                        <span>{item.assigned_name || 'Unassigned'}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">{formatDate(item.due_date)}</span>
                        <span aria-hidden="true">·</span>
                        <PriorityBadge priority={item.priority} />
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-slate-50 text-xs">
                    {hasCalendarEvent ? (
                      <span className="text-brand-gradient text-[11px] font-medium flex items-center gap-1">
                        <CalendarCheck className="w-3.5 h-3.5" />
                        Scheduled in Calendar
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setCalendarTargetItem(item);
                          setCalendarModalOpen(true);
                        }}
                        className="text-slate-500 hover:text-brand-gradient text-[11px] font-medium flex items-center gap-1"
                      >
                        <CalendarPlus className="w-3.5 h-3.5" />
                        Add to Calendar
                      </button>
                    )}

                    {!disabled && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingItem(item);
                            setModalOpen(true);
                          }}
                          className="p-1 text-slate-400 hover:text-slate-700"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setDeletingItem(item);
                            setConfirmDeleteOpen(true);
                          }}
                          className="p-1 text-slate-400 hover:text-rose-600"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Edit / Add Modal */}
      <ActionItemModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        meetingId={meetingId}
        actionItem={editingItem}
        onSaved={onReload}
      />

      {/* Add To Calendar Modal */}
      <AddToCalendarModal
        isOpen={calendarModalOpen}
        onClose={() => setCalendarModalOpen(false)}
        actionItem={calendarTargetItem}
        onCalendarSynced={onReload}
      />

      {/* Confirm Delete */}
      <ConfirmDialog
        isOpen={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Delete Action Item"
        message={`Are you sure you want to delete "${deletingItem?.task}"? This cannot be undone.`}
        confirmText="Delete"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
}

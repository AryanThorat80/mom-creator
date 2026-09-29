import { useState, useEffect } from 'react';
import { Modal } from '../common/Modal.jsx';
import { Input } from '../common/Input.jsx';
import { Textarea } from '../common/Textarea.jsx';
import { Button } from '../common/Button.jsx';
import { Calendar, AlertCircle } from 'lucide-react';
import { createCalendarEvent, connectGoogleCalendar, getGoogleCalendarStatus } from '../../services/googleCalendar.js';
import { useToast } from '../../context/ToastContext.jsx';

export function AddToCalendarModal({
  isOpen,
  onClose,
  actionItem,
  onCalendarSynced,
}) {
  const { showToast } = useToast();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDatetime, setStartDatetime] = useState('');
  const [endDatetime, setEndDatetime] = useState('');
  const [timeZone, setTimeZone] = useState(() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
      return 'UTC';
    }
  });

  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(false);
  const [calendarConnected, setCalendarConnected] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen && actionItem) {
      setTitle(actionItem.task || '');
      setDescription(`Action item assigned to: ${actionItem.assigned_name || 'Unassigned'}\nPriority: ${actionItem.priority || 'Medium'}`);

      // Calculate initial start/end from action item's due_date or tomorrow 10am
      const baseDate = actionItem.due_date ? new Date(actionItem.due_date) : new Date(Date.now() + 24 * 60 * 60 * 1000);
      baseDate.setHours(10, 0, 0, 0);

      const endDate = new Date(baseDate);
      endDate.setMinutes(baseDate.getMinutes() + 30);

      const formatForInput = (d) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hours = String(d.getHours()).padStart(2, '0');
        const mins = String(d.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${mins}`;
      };

      setStartDatetime(formatForInput(baseDate));
      setEndDatetime(formatForInput(endDate));
      setError('');

      checkCalendar();
    }
  }, [isOpen, actionItem]);

  const checkCalendar = async () => {
    setCheckingAuth(true);
    try {
      const status = await getGoogleCalendarStatus();
      setCalendarConnected(Boolean(status?.connected && status?.calendar_scope_granted));
    } catch {
      setCalendarConnected(false);
    } finally {
      setCheckingAuth(false);
    }
  };

  const handleConnectCalendar = async () => {
    try {
      const res = await connectGoogleCalendar();
      if (res?.authorization_url) {
        window.location.href = res.authorization_url;
      }
    } catch (err) {
      showToast(err.message || 'Failed to connect Google Calendar', 'error');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Event title is required');
      return;
    }

    const start = new Date(startDatetime);
    const end = new Date(endDatetime);

    if (end <= start) {
      setError('End date/time must be strictly after start date/time');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const result = await createCalendarEvent(actionItem.id, {
        title: title.trim(),
        description: description.trim(),
        start_datetime: start.toISOString(),
        end_datetime: end.toISOString(),
        time_zone: timeZone,
      });

      showToast('Event created in Google Calendar', 'success');
      if (onCalendarSynced) {
        onCalendarSynced(result);
      }
      onClose();
    } catch (err) {
      console.error('Calendar event creation error:', err);
      if (err.status === 401 || err.status === 403 || err.message?.includes('OAuth') || err.message?.includes('not connected')) {
        setCalendarConnected(false);
        setError('Google Calendar authorization required.');
      } else {
        setError(err.message || 'Failed to create calendar event.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add to Google Calendar"
      description="Create a dedicated scheduled event for this action item."
      maxWidth="max-w-lg"
    >
      {!calendarConnected ? (
        <div className="py-6 text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
            <Calendar className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-semibold text-slate-900">Google Calendar Not Connected</h4>
          <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
            Connect your Google account with calendar permissions to schedule action items directly to your primary calendar.
          </p>
          <div className="pt-2">
            <Button onClick={handleConnectCalendar} size="sm">
              Connect Google Calendar
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Event Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            autoFocus
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Input
              type="datetime-local"
              label="Start Date & Time"
              value={startDatetime}
              onChange={(e) => setStartDatetime(e.target.value)}
              required
            />
            <Input
              type="datetime-local"
              label="End Date & Time"
              value={endDatetime}
              onChange={(e) => setEndDatetime(e.target.value)}
              required
            />
          </div>

          <Input
            label="Time Zone"
            value={timeZone}
            onChange={(e) => setTimeZone(e.target.value)}
            helperText="e.g. Asia/Kolkata, America/New_York, Europe/London"
            required
          />

          <Textarea
            label="Description"
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          {error && (
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
            <Button variant="secondary" size="sm" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" size="sm" loading={loading} icon={Calendar}>
              Create Event
            </Button>
          </div>
        </form>
      )}
    </Modal>
  );
}

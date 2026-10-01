import { useState, useEffect } from 'react';
import { Plus, ArrowRight, Video, Calendar, CheckCircle2, Clock, AlertCircle, Sparkles, RefreshCw } from 'lucide-react';
import { Button } from '../components/common/Button.jsx';
import { MeetingCard } from '../components/meeting/MeetingCard.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useWorkspace } from '../context/WorkspaceContext.jsx';
import { listMeetings, deleteMeeting } from '../services/meetings.js';
import { getFirefliesStatus, refreshFireflies } from '../services/fireflies.js';
import { getGoogleCalendarStatus } from '../services/googleCalendar.js';
import { ConfirmDialog } from '../components/common/ConfirmDialog.jsx';
import { useToast } from '../context/ToastContext.jsx';

export function DashboardPage({
  onNavigate,
  onOpenCreateMeeting,
}) {
  const { user, profile } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const { showToast } = useToast();
  const [firefliesStatus, setFirefliesStatus] =
    useState(null);

  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [googleCalendarConnected, setGoogleCalendarConnected] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [firefliesConnected, setFirefliesConnected] = useState(false);
  const [firefliesNextRefreshAt, setFirefliesNextRefreshAt] = useState(null);
  const [refreshingFireflies, setRefreshingFireflies] = useState(false);
  const [firefliesCountdown, setFirefliesCountdown] = useState('');

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 18) return 'Good afternoon';
    return 'Good evening';
  };

  const displayName = profile?.name || user?.email?.split('@')[0] || 'there';

  const loadData = async () => {
    if (!currentWorkspace?.id) return;
    setLoading(true);
    try {
      const [meetingsData, calStatus, firefliesStatus] = await Promise.allSettled([
        listMeetings(currentWorkspace.id),
        getGoogleCalendarStatus(),
        getFirefliesStatus(currentWorkspace.id),
      ]);

      if (meetingsData.status === 'fulfilled' && Array.isArray(meetingsData.value)) {
        setMeetings(meetingsData.value);
      } else {
        setMeetings([]);
      }

      if (calStatus.status === 'fulfilled' && calStatus.value?.connected) {
        setGoogleCalendarConnected(Boolean(calStatus.value.calendar_scope_granted));
      }

      if (firefliesStatus.status === 'fulfilled') {
        setFirefliesConnected(Boolean(firefliesStatus.value?.connected));
        setFirefliesNextRefreshAt(firefliesStatus.value?.next_refresh_at || null);
      } else {
        setFirefliesConnected(false);
        setFirefliesNextRefreshAt(null);
      }
    } catch (err) {
      console.warn('Dashboard data loading:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentWorkspace?.id]);

  useEffect(() => {
    if (!firefliesNextRefreshAt) {
      setFirefliesCountdown('');
      return;
    }

    const updateCountdown = () => {
      const remaining = Math.max(0, new Date(firefliesNextRefreshAt).getTime() - Date.now());
      if (remaining <= 0) {
        setFirefliesCountdown('');
        return;
      }
      const totalMinutes = Math.ceil(remaining / 60000);
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      setFirefliesCountdown(hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`);
    };

    updateCountdown();
    const timer = window.setInterval(updateCountdown, 30000);
    return () => window.clearInterval(timer);
  }, [firefliesNextRefreshAt]);

  const handleRefreshFireflies = async () => {
    if (!currentWorkspace?.id || refreshingFireflies || firefliesCountdown) return;
    setRefreshingFireflies(true);
    try {
      const result = await refreshFireflies(currentWorkspace.id);
      setFirefliesNextRefreshAt(result?.next_refresh_at || null);
      showToast(
        result?.imported
          ? `Imported ${result.imported} Fireflies meeting${result.imported === 1 ? '' : 's'}.`
          : 'Fireflies checked. No new meetings found.',
        'success'
      );
      await loadData();
    } catch (err) {
      if (err?.status === 429 && err?.data?.detail?.next_refresh_at) {
        setFirefliesNextRefreshAt(err.data.detail.next_refresh_at);
      }
      showToast(err.message || 'Failed to refresh Fireflies meetings', 'error');
    } finally {
      setRefreshingFireflies(false);
    }
  };

  const handleDeleteMeeting = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteMeeting(deleteTarget.id);
      showToast('Meeting deleted', 'success');
      setDeleteTarget(null);
      loadData();
    } catch (err) {
      showToast(err.message || 'Failed to delete meeting', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const recentMeetings = meetings.slice(0, 4);

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-8 space-y-8">
      {/* Top Welcome Area */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-200">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            {greeting()}, {displayName}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Your meetings and action items in one place.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {firefliesStatus?.connected && (
              <Button
                variant="secondary"
                onClick={handleRefreshFireflies}
                loading={refreshingFireflies}
                disabled={
                  !firefliesStatus.sync_available ||
                  refreshingFireflies
                }
                icon={RefreshCw}
              >
                {firefliesStatus.sync_available
                  ? 'Refresh Fireflies'
                  : 'Fireflies synced'}
              </Button>
            )}
            <Button onClick={onOpenCreateMeeting} icon={Plus}>
              New Meeting
            </Button>
          </div>
        </div>
      </div>

      {/* Integration Quick Status Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-white shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-50 text-brand-gradient flex items-center justify-center shrink-0">
              <Video className="w-4 h-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-900">Online Meeting</p>
              <p className="text-[11px] text-slate-500">Conduct meetings & sync transcripts</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('/integrations')}
            className="text-xs font-semibold text-brand-gradient hover:text-indigo-700 cursor-pointer"
          >
            Configure →
          </button>
        </div>

        <div className="flex items-center justify-between p-4 rounded-xl border border-slate-200 bg-white shadow-2xs">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
              googleCalendarConnected ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'
            }`}>
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <p className="text-xs font-semibold text-slate-900">Google Calendar</p>
                {googleCalendarConnected && (
                  <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded">
                    Active
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500">Schedule action items to your calendar</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('/integrations')}
            className="text-xs font-semibold text-brand-gradient hover:text-indigo-700 cursor-pointer"
          >
            {googleCalendarConnected ? 'Manage →' : 'Connect →'}
          </button>
        </div>
      </div>

      {/* Recent Meetings Module */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900 tracking-tight">Recent Meetings</h2>
            <p className="text-xs text-slate-500">
              Latest sessions captured in {currentWorkspace?.name || 'this workspace'}.
            </p>
          </div>
          {meetings.length > 4 && (
            <button
              type="button"
              onClick={() => onNavigate('/meetings')}
              className="text-xs font-semibold text-brand-gradient hover:text-indigo-700 flex items-center gap-1 cursor-pointer"
            >
              <span>View all ({meetings.length})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2].map((i) => (
              <div key={i} className="h-32 rounded-xl bg-slate-100 animate-pulse" />
            ))}
          </div>
        ) : meetings.length === 0 ? (
          <div className="p-8 text-center rounded-xl border border-dashed border-slate-200 bg-white space-y-3">
            <p className="text-xs font-semibold text-slate-800">No meetings yet</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Create your first meeting and turn the conversation into structured MOM and action items.
            </p>
            <Button size="sm" onClick={onOpenCreateMeeting} icon={Plus}>
              Create First Meeting
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {recentMeetings.map((m) => (
              <MeetingCard
                key={m.id}
                meeting={m}
                onOpen={() => onNavigate(`/meetings/${m.id}`)}
                onDelete={(meeting) => setDeleteTarget(meeting)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Delete Meeting Confirmation */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteMeeting}
        title="Delete Meeting"
        message={`Are you sure you want to delete "${deleteTarget?.title}"? All associated minutes, attachments, and action items will be removed.`}
        confirmText="Delete Meeting"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
}

export function MeetingModeBadge({ mode }) {
  switch (mode) {

    case 'fireflies':
      return (
        <span className="inline-flex items-center gap-1 text-xs text-slate-600 font-medium">
          <Flame className="w-3.5 h-3.5 text-orange-600 shrink-0" />
          <span>Fireflies</span>
        </span>
      );

    case 'google_meet':
      return (
        <span className="inline-flex items-center gap-1 text-xs text-slate-600 font-medium">
          <Video className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
          <span>Online Meeting · Google Meet</span>
        </span>
      );

    case 'mic_recording':
      return (
        <span className="inline-flex items-center gap-1 text-xs text-slate-600 font-medium">
          <Mic className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>Microphone</span>
        </span>
      );

    case 'upload':
      return (
        <span className="inline-flex items-center gap-1 text-xs text-slate-600 font-medium">
          <UploadCloud className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          <span>Uploaded Recording</span>
        </span>
      );

    case 'import':
      return (
        <span className="inline-flex items-center gap-1 text-xs text-slate-600 font-medium">
          <FileSpreadsheet className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span>Import</span>
        </span>
      );

    default:
      return (
        <span className="text-xs text-slate-500 capitalize">
          {mode}
        </span>
      );
  }
}
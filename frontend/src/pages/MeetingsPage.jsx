import { useState, useEffect } from 'react';
import { Search, Plus, Filter, CalendarDays, ArrowRight } from 'lucide-react';
import { Button } from '../components/common/Button.jsx';
import { MeetingCard } from '../components/meeting/MeetingCard.jsx';
import { MeetingStatusBadge, MeetingModeBadge } from '../components/common/StatusBadge.jsx';
import { ConfirmDialog } from '../components/common/ConfirmDialog.jsx';
import { useWorkspace } from '../context/WorkspaceContext.jsx';
import { listMeetings, deleteMeeting } from '../services/meetings.js';
import { useToast } from '../context/ToastContext.jsx';

export function MeetingsPage({
  onNavigate,
  onOpenCreateMeeting,
}) {
  const { currentWorkspace } = useWorkspace();
  const { showToast } = useToast();

  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterMode, setFilterMode] = useState('all'); // all | upload | mic_recording | google_meet | zoom | import

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const loadMeetings = async () => {
    if (!currentWorkspace?.id) return;
    setLoading(true);
    try {
      const data = await listMeetings(currentWorkspace.id);
      setMeetings(Array.isArray(data) ? data : []);
    } catch (err) {
      showToast(err.message || 'Failed to load meetings', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMeetings();
  }, [currentWorkspace?.id]);

  const handleDeleteMeeting = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteMeeting(deleteTarget.id);
      showToast('Meeting deleted', 'success');
      setDeleteTarget(null);
      loadMeetings();
    } catch (err) {
      showToast(err.message || 'Failed to delete meeting', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const filteredMeetings = meetings.filter((m) => {
    const matchesSearch =
      !searchQuery.trim() ||
      m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.description?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesMode = filterMode === 'all' || m.mode === filterMode;
    return matchesSearch && matchesMode;
  });

  const formatDate = (dateStr) => {
    if (!dateStr) return 'No date';
    try {
      const d = new Date(dateStr);
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }).format(d);
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-8 space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Meetings</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            All captured sessions in {currentWorkspace?.name || 'current workspace'}.
          </p>
        </div>

        <Button onClick={onOpenCreateMeeting} icon={Plus}>
          New Meeting
        </Button>
      </div>

      {/* Filter / Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            placeholder="Search meetings by title..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3.5 py-2 text-xs rounded-lg border border-slate-300 bg-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 transition-colors"
          />
        </div>

        {/* Mode filter tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto text-xs font-medium">
          {[
            { id: 'all', label: 'All' },
            { id: 'upload', label: 'Uploads' },
            { id: 'mic_recording', label: 'Mic' },
            { id: 'google_meet', label: 'Online / Google Meet' },
            { id: 'zoom', label: 'Online / Zoom' },
            { id: 'import', label: 'Imports' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterMode(tab.id)}
              className={`px-3 py-1 rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                filterMode === tab.id
                  ? 'bg-white text-slate-900 font-semibold shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : filteredMeetings.length === 0 ? (
        <div className="p-12 text-center rounded-xl border border-dashed border-slate-200 bg-white space-y-3">
          <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 mx-auto">
            <CalendarDays className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-slate-800">
            {searchQuery || filterMode !== 'all' ? 'No matching meetings' : 'No meetings found'}
          </p>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchQuery || filterMode !== 'all'
              ? 'Try adjusting your search query or mode filters.'
              : 'Create a meeting using microphone recording, file upload, or an Online Meeting.'}
          </p>
          {!searchQuery && filterMode === 'all' && (
            <div className="pt-2">
              <Button size="sm" onClick={onOpenCreateMeeting} icon={Plus}>
                Create Meeting
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {/* Desktop Table View */}
          <div className="hidden md:block bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/75 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-5">Title</th>
                  <th className="py-3 px-5">Date</th>
                  <th className="py-3 px-5">Capture Mode</th>
                  <th className="py-3 px-5">Status</th>
                  <th className="py-3 px-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredMeetings.map((m) => (
                  <tr
                    key={m.id}
                    onClick={() => onNavigate(`/meetings/${m.id}`)}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                  >
                    <td className="py-3.5 px-5">
                      <div className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">
                        {m.title}
                      </div>
                      {m.description && (
                        <div className="text-[11px] text-slate-500 truncate max-w-md mt-0.5">
                          {m.description}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-5 text-slate-600 font-mono tabular-nums whitespace-nowrap">
                      {formatDate(m.meeting_date || m.created_at)}
                    </td>
                    <td className="py-3.5 px-5">
                      <MeetingModeBadge mode={m.mode} />
                    </td>
                    <td className="py-3.5 px-5">
                      <MeetingStatusBadge status={m.status} />
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      <span className="text-indigo-600 font-medium inline-flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                        Open <ArrowRight className="w-3.5 h-3.5" />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Stacked View */}
          <div className="md:hidden grid grid-cols-1 gap-3">
            {filteredMeetings.map((m) => (
              <MeetingCard
                key={m.id}
                meeting={m}
                onOpen={() => onNavigate(`/meetings/${m.id}`)}
                onDelete={(meeting) => setDeleteTarget(meeting)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteMeeting}
        title="Delete Meeting"
        message={`Are you sure you want to delete "${deleteTarget?.title}"? This cannot be undone.`}
        confirmText="Delete Meeting"
        variant="danger"
        loading={deleting}
      />
    </div>
  );
}

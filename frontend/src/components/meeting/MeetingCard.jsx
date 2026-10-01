import { Calendar, Trash2, ArrowRight, Clock } from 'lucide-react';
import { MeetingStatusBadge, MeetingModeBadge } from '../common/StatusBadge.jsx';

export function MeetingCard({ meeting, onOpen, onDelete }) {
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
    <div
      onClick={onOpen}
      className="group relative flex flex-col justify-between p-4.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs transition-all cursor-pointer"
    >
      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <MeetingModeBadge mode={meeting.mode} />
          <MeetingStatusBadge status={meeting.status} />
        </div>

        <div>
          <h3 className="text-sm font-semibold text-slate-900 group-hover:text-brand-gradient transition-colors line-clamp-1">
            {meeting.title}
          </h3>
          {meeting.description && (
            <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
              {meeting.description}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between pt-3.5 mt-3.5 border-t border-slate-100 text-xs text-slate-400">
        <div className="flex items-center gap-1.5 font-mono tabular-nums text-slate-500">
          <Calendar className="w-3.5 h-3.5 text-slate-400" />
          <span>{formatDate(meeting.meeting_date || meeting.created_at)}</span>
        </div>

        <div className="flex items-center gap-1">
          {onDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(meeting);
              }}
              title="Delete meeting"
              className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          <span className="text-brand-gradient font-medium flex items-center gap-0.5 group-hover:translate-x-0.5 transition-transform text-xs">
            Open <ArrowRight className="w-3.5 h-3.5" />
          </span>
        </div>
      </div>
    </div>
  );
}

import { Flame,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileEdit,
  Lock,
  ArrowUpRight,
  Video,
  Mic,
  UploadCloud,
  FileSpreadsheet,
  AlertTriangle,
  Minus,
} from 'lucide-react';

export function MeetingStatusBadge({ status }) {
  const norm = (status || 'draft').toLowerCase();

  if (norm === 'completed') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
        <span>Completed</span>
      </span>
    );
  }
  if (norm === 'processing' || norm === 'uploading') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-700">
        <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse shrink-0" />
        <span className="capitalize">{norm}</span>
      </span>
    );
  }
  if (norm === 'failed') {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-700">
        <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
        <span>Failed</span>
      </span>
    );
  }

  // draft or default
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-600">
      <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
      <span>Draft</span>
    </span>
  );
}

export function MOMStatusBadge({ status }) {
  const norm = (status || 'draft').toLowerCase();

  if (norm === 'finalized') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200/80 text-xs font-medium">
        <Lock className="w-3 h-3 text-emerald-600 shrink-0" />
        <span>Finalized (Locked)</span>
      </span>
    );
  }
  if (norm === 'reviewed') {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 text-blue-800 border border-blue-200/80 text-xs font-medium">
        <CheckCircle2 className="w-3 h-3 text-blue-600 shrink-0" />
        <span>Reviewed</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 border border-slate-200 text-xs font-medium">
      <FileEdit className="w-3 h-3 text-slate-500 shrink-0" />
      <span>Draft</span>
    </span>
  );
}

export function ActionItemStatusBadge({ status }) {
  const norm = (status || 'pending').toLowerCase();

  switch (norm) {
    case 'completed':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
          <span>Completed</span>
        </span>
      );
    case 'in_progress':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700">
          <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
          <span>In Progress</span>
        </span>
      );
    case 'cancelled':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 line-through">
          <span>Cancelled</span>
        </span>
      );
    case 'pending':
    default:
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700">
          <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span>Pending</span>
        </span>
      );
  }
}

export function PriorityBadge({ priority }) {
  const norm = (priority || 'medium').toLowerCase();

  switch (norm) {
    case 'urgent':
      return (
        <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-700">
          <Flame className="w-3.5 h-3.5 text-rose-600 shrink-0" />
          <span>Urgent</span>
        </span>
      );
    case 'high':
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-orange-700">
          <AlertTriangle className="w-3.5 h-3.5 text-orange-600 shrink-0" />
          <span>High</span>
        </span>
      );
    case 'medium':
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600">
          <Minus className="w-3.5 h-3.5 text-slate-400 shrink-0" />
          <span>Medium</span>
        </span>
      );
    case 'low':
    default:
      return (
        <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-500">
          <Minus className="w-3.5 h-3.5 text-slate-300 shrink-0" />
          <span>Low</span>
        </span>
      );
  }
}

export function MeetingModeBadge({ mode }) {
  switch (mode) {
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
    case 'fireflies':
      return (
        <span className="inline-flex items-center gap-1 text-xs text-slate-600 font-medium">
          <Flame className="w-3.5 h-3.5 text-orange-500 shrink-0" />
          <span>Fireflies</span>
        </span>
      );
    default:
      return <span className="text-xs text-slate-500 capitalize">{mode}</span>;
  }
}

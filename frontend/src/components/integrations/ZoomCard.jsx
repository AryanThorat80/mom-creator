import { useEffect, useState } from 'react';
import { Video, ExternalLink, Copy, Check, Plus, RefreshCw } from 'lucide-react';import { Button } from '../common/Button.jsx';
import {
  createZoomMeeting,
  getZoomMeeting,
  connectZoom,
  syncZoomTranscript,
} from '../../services/zoom.js';
import { useToast } from '../../context/ToastContext.jsx';

export function ZoomCard({ meetingId }) {
  const { showToast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [syncingTranscript, setSyncingTranscript] = useState(false);

  const fetchZoom = async () => {
    setLoading(true);
    try {
      const result = await getZoomMeeting(meetingId);
      if (result?.meeting_uri) setData(result);
    } catch (err) {
      if (err.status !== 404) showToast(err.message || 'Could not check Zoom status', 'warning');
    } finally { setLoading(false); }
  };

  useEffect(() => { if (meetingId) fetchZoom(); }, [meetingId]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const result = await createZoomMeeting(meetingId);
      setData(result);
      showToast('Zoom meeting created successfully', 'success');
    } catch (err) {
      if (err.status === 400 && err.message?.toLowerCase().includes('not connected')) {
        try {
          const auth = await connectZoom();
          if (auth?.authorization_url) {
            window.location.href = auth.authorization_url;
            return;
          }
        } catch (connectErr) {
          showToast(connectErr.message || 'Failed to start Zoom connection', 'error');
        }
      } else {
        showToast(err.message || 'Failed to create Zoom meeting', 'error');
      }
    } finally { setCreating(false); }
  };

  const handleSyncTranscript = async () => {
    setSyncingTranscript(true);

    try {
      await syncZoomTranscript(meetingId);

      showToast(
        'Zoom transcript synced successfully. You can now generate the MOM.',
        'success'
      );
    } catch (err) {
      if (err.status === 409) {
        showToast(
          err.message || 'Zoom transcript is not ready yet. Please try again later.',
          'warning'
        );
      } else {
        showToast(
          err.message || 'Failed to sync Zoom transcript',
          'error'
        );
      }
    } finally {
      setSyncingTranscript(false);
    }
  };

  const copyLink = async () => {
    if (!data?.meeting_uri) return;
    await navigator.clipboard.writeText(data.meeting_uri);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    showToast('Zoom meeting link copied', 'info');
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
      <div className="flex items-center gap-2.5 pb-3 border-b border-slate-100">
        <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
          <Video className="w-4 h-4" />
        </div>
        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-700">Online Meeting · Zoom</h4>
          <p className="text-[11px] text-slate-500">Create and open the Zoom meeting linked to this MOM.</p>
        </div>
      </div>

      {!data ? (
        <div className="py-4 text-center space-y-3">
          <p className="text-xs text-slate-600 max-w-sm mx-auto">Connect Zoom if needed, then create the meeting.</p>
          <Button size="sm" onClick={handleCreate} loading={creating || loading} icon={Plus}>Create Zoom Meeting</Button>
        </div>
      ) : (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg bg-slate-50 border border-slate-200">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">Zoom Meeting Link</p>
            <a href={data.meeting_uri} target="_blank" rel="noreferrer" className="text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1 mt-0.5 break-all">
              <span>{data.meeting_uri}</span><ExternalLink className="w-3 h-3 shrink-0" />
            </a>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <Button
              variant="secondary"
              size="sm"
              onClick={copyLink}
              icon={copied ? Check : Copy}
            >
              {copied ? 'Copied' : 'Copy'}
            </Button>

            <Button
              variant="secondary"
              size="sm"
              onClick={handleSyncTranscript}
              loading={syncingTranscript}
              icon={RefreshCw}
            >
              Sync Transcript
            </Button>

            <a
              href={data.meeting_uri}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center font-medium bg-indigo-600 hover:bg-indigo-700 text-white px-3.5 py-2 text-sm gap-2 rounded-lg min-h-10"
            >
              Open Zoom
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

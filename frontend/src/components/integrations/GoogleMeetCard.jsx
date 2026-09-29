import { useState, useEffect } from 'react';
import { Video, ExternalLink, RefreshCw, Copy, Check, Plus } from 'lucide-react';
import { Button } from '../common/Button.jsx';
import { createGoogleMeet, getGoogleMeet, syncGoogleMeetTranscript, connectGoogleMeet } from '../../services/googleMeet.js';
import { useToast } from '../../context/ToastContext.jsx';

export function GoogleMeetCard({
  meetingId,
  onTranscriptSynced,
}) {
  const { showToast } = useToast();
  const [meetData, setMeetData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchMeet = async () => {
    setLoading(true);
    try {
      const data = await getGoogleMeet(meetingId);
      if (data && (data.meeting_uri || data.meeting_code)) {
        setMeetData(data);
      }
    } catch (err) {
      // 404 means Google Meet has not been created yet for this meeting
      if (err.status !== 404) {
        console.warn('Google Meet fetch error:', err);
        showToast(err.message || 'Could not check Google Meet space status', 'warning');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (meetingId) {
      fetchMeet();
    }
  }, [meetingId]);

  const handleCreateMeet = async () => {
    setCreating(true);
    try {
      const res = await createGoogleMeet(meetingId);
      setMeetData(res);
      showToast('Google Meet created successfully', 'success');
    } catch (err) {
      console.error('Failed to create meet:', err);
      if (err.status === 401 || err.status === 403 || err.message?.includes('not connected') || err.message?.includes('OAuth')) {
        showToast('Google account not connected. Redirecting to Google authorization...', 'warning');
        try {
          const authRes = await connectGoogleMeet();
          if (authRes.authorization_url) {
            window.location.href = authRes.authorization_url;
            return;
          }
        } catch (connErr) {
          showToast(connErr.message || 'Failed to start Google connection', 'error');
        }
      } else {
        showToast(err.message || 'Failed to create Google Meet', 'error');
      }
    } finally {
      setCreating(false);
    }
  };

  const handleSyncTranscript = async () => {
    setSyncing(true);
    try {
      const res = await syncGoogleMeetTranscript(meetingId);
      showToast('Transcript synced from Google Meet', 'success');
      if (onTranscriptSynced) {
        onTranscriptSynced(res);
      }
    } catch (err) {
      console.error('Failed to sync transcript:', err);
      showToast(err.message || 'Transcript is not yet available from Google Meet. Please try again after the meeting ends.', 'warning');
    } finally {
      setSyncing(false);
    }
  };

  const copyLink = () => {
    if (meetData?.meeting_uri) {
      navigator.clipboard.writeText(meetData.meeting_uri);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      showToast('Meeting link copied to clipboard', 'info');
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Video className="w-4 h-4" />
          </div>
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
              Online Meeting · Google Meet
            </h4>
            <p className="text-[11px] text-slate-500">
              Conduct the meeting on Google Meet and import the automatic transcript.
            </p>
          </div>
        </div>
      </div>

      {!meetData ? (
        <div className="py-4 text-center space-y-3">
          <p className="text-xs text-slate-600 max-w-sm mx-auto">
            Create a Google Meet space linked to this meeting.
          </p>
          <Button
            size="sm"
            onClick={handleCreateMeet}
            loading={creating}
            icon={Plus}
          >
            Create Online Meeting
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg bg-slate-50 border border-slate-200">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Online Meeting Link
              </p>
              <a
                href={meetData.meeting_uri}
                target="_blank"
                rel="noreferrer"
                className="text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1 mt-0.5 break-all"
              >
                <span>{meetData.meeting_uri || meetData.meeting_code}</span>
                <ExternalLink className="w-3 h-3 shrink-0" />
              </a>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={copyLink}
                icon={copied ? Check : Copy}
              >
                {copied ? 'Copied' : 'Copy'}
              </Button>
              <a
                href={meetData.meeting_uri}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center font-medium transition-colors cursor-pointer select-none whitespace-nowrap bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs px-3.5 py-2 text-sm gap-2 rounded-lg min-h-10"
              >
                Open Google Meet
              </a>
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              When the meeting has concluded and Google finishes processing:
            </p>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleSyncTranscript}
              loading={syncing}
              icon={RefreshCw}
            >
              Sync Transcript
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

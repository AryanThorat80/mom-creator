import { useState, useEffect } from 'react';
import { Video, Calendar, CheckCircle2, AlertCircle, ExternalLink, Link2, RefreshCw } from 'lucide-react';
import { Button } from '../components/common/Button.jsx';
import { getGoogleCalendarStatus, connectGoogleCalendar } from '../services/googleCalendar.js';
import { connectGoogleMeet } from '../services/googleMeet.js';
import { connectZoom } from '../services/zoom.js';
import { useToast } from '../context/ToastContext.jsx';

export function IntegrationsPage() {
  const { showToast } = useToast();
  const [calendarStatus, setCalendarStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connectingMeet, setConnectingMeet] = useState(false);
  const [connectingCal, setConnectingCal] = useState(false);
  const [connectingZoom, setConnectingZoom] = useState(false);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const cal = await getGoogleCalendarStatus();
      setCalendarStatus(cal);
    } catch (err) {
      console.warn('Error fetching Google status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleConnectMeet = async () => {
    setConnectingMeet(true);
    try {
      const res = await connectGoogleMeet();
      if (res?.authorization_url) {
        window.location.href = res.authorization_url;
      }
    } catch (err) {
      showToast(err.message || 'Failed to start Google Meet connection', 'error');
    } finally {
      setConnectingMeet(false);
    }
  };

  const handleConnectZoom = async () => {
    setConnectingZoom(true);
    try {
      const res = await connectZoom();
      if (res?.authorization_url) window.location.href = res.authorization_url;
    } catch (err) {
      showToast(err.message || 'Failed to start Zoom connection', 'error');
    } finally {
      setConnectingZoom(false);
    }
  };

  const handleConnectCalendar = async () => {
    setConnectingCal(true);
    try {
      const res = await connectGoogleCalendar();
      if (res?.authorization_url) {
        window.location.href = res.authorization_url;
      }
    } catch (err) {
      showToast(err.message || 'Failed to start Google Calendar connection', 'error');
    } finally {
      setConnectingCal(false);
    }
  };

  const isCalConnected = Boolean(calendarStatus?.connected && calendarStatus?.calendar_scope_granted);

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-8 space-y-6">
      <div className="pb-4 border-b border-slate-200">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Integrations</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Connect your Google Workspace accounts to automate meeting transcripts and action item scheduling.
        </p>
      </div>

      <div className="space-y-4">
        {/* Google Meet */}
        <div className="p-6 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <Video className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-slate-900">Google Meet</h3>
                <p className="text-xs text-slate-500 max-w-xl leading-relaxed">
                  Used exclusively for meeting capture. Automatically create dedicated Google Meet spaces and import the generated transcripts directly into your Minutes of Meeting.
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleConnectMeet}
              loading={connectingMeet}
              icon={Link2}
            >
              Connect Google
            </Button>
          </div>
        </div>

        {/* Zoom */}
        <div className="p-6 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                <Video className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-slate-900">Zoom</h3>
                <p className="text-xs text-slate-500 max-w-xl leading-relaxed">
                  Connect Zoom so MOM Creator can create online meetings on your Zoom account.
                </p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleConnectZoom} loading={connectingZoom} icon={Link2}>
              Connect Zoom
            </Button>
          </div>
        </div>

        {/* Google Calendar */}
        <div className="p-6 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                  isCalConnected
                    ? 'bg-emerald-50 text-emerald-600'
                    : 'bg-slate-100 text-slate-500'
                }`}
              >
                <Calendar className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-slate-900">Google Calendar</h3>
                  {isCalConnected ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Connected
                    </span>
                  ) : (
                    <span className="text-[11px] font-medium text-slate-400">Not Connected</span>
                  )}
                </div>
                <p className="text-xs text-slate-500 max-w-xl leading-relaxed">
                  Used exclusively for scheduling action items. Allows assigning tasks directly to your primary calendar with custom scheduled start and end times.
                </p>
              </div>
            </div>

            <Button
              variant={isCalConnected ? 'secondary' : 'primary'}
              size="sm"
              onClick={handleConnectCalendar}
              loading={connectingCal}
              icon={Link2}
            >
              {isCalConnected ? 'Reconnect Calendar' : 'Connect Calendar'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

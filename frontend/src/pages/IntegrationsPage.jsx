import { useState, useEffect } from 'react';
import { Video, Calendar, CheckCircle2, Link2, RefreshCw, Flame, Unplug } from 'lucide-react';
import { Button } from '../components/common/Button.jsx';
import { getGoogleCalendarStatus, connectGoogleCalendar } from '../services/googleCalendar.js';
import { connectGoogleMeet } from '../services/googleMeet.js';
import { connectFireflies, disconnectFireflies, getFirefliesStatus } from '../services/fireflies.js';
import { useWorkspace } from '../context/WorkspaceContext.jsx';
import { useToast } from '../context/ToastContext.jsx';

export function IntegrationsPage() {
  const { currentWorkspace } = useWorkspace();
  const { showToast } = useToast();
  const [calendarStatus, setCalendarStatus] = useState(null);
  const [firefliesStatus, setFirefliesStatus] = useState(null);
  const [firefliesKey, setFirefliesKey] = useState('');
  const [loading, setLoading] = useState(true);
  const [connectingMeet, setConnectingMeet] = useState(false);
  const [connectingCal, setConnectingCal] = useState(false);
  const [connectingFireflies, setConnectingFireflies] = useState(false);
  const [disconnectingFireflies, setDisconnectingFireflies] = useState(false);

  const fetchStatus = async () => {
    if (!currentWorkspace?.id) return;
    setLoading(true);
    try {
      const [cal, fireflies] = await Promise.all([
        getGoogleCalendarStatus(),
        getFirefliesStatus(currentWorkspace.id),
      ]);
      setCalendarStatus(cal);
      setFirefliesStatus(fireflies);
    } catch (err) {
      console.warn('Error fetching integration status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, [currentWorkspace?.id]);

  const handleConnectMeet = async () => {
    setConnectingMeet(true);
    try {
      const res = await connectGoogleMeet();
      if (res?.authorization_url) window.location.href = res.authorization_url;
    } catch (err) {
      showToast(err.message || 'Failed to start Google Meet connection', 'error');
    } finally {
      setConnectingMeet(false);
    }
  };

  const handleConnectCalendar = async () => {
    setConnectingCal(true);
    try {
      const res = await connectGoogleCalendar();
      if (res?.authorization_url) window.location.href = res.authorization_url;
    } catch (err) {
      showToast(err.message || 'Failed to start Google Calendar connection', 'error');
    } finally {
      setConnectingCal(false);
    }
  };

  const handleConnectFireflies = async () => {
    if (!currentWorkspace?.id || !firefliesKey.trim()) {
      showToast('Enter your Fireflies API key first.', 'error');
      return;
    }
    setConnectingFireflies(true);
    try {
      await connectFireflies({
        workspace_id: currentWorkspace.id,
        api_key: firefliesKey.trim(),
      });
      setFirefliesKey('');
      showToast('Fireflies connected to this workspace.', 'success');
      await fetchStatus();
    } catch (err) {
      showToast(err.message || 'Failed to connect Fireflies', 'error');
    } finally {
      setConnectingFireflies(false);
    }
  };

  const handleDisconnectFireflies = async () => {
    if (!currentWorkspace?.id) return;
    setDisconnectingFireflies(true);
    try {
      await disconnectFireflies(currentWorkspace.id);
      showToast('Fireflies disconnected. Existing meetings were kept.', 'success');
      await fetchStatus();
    } catch (err) {
      showToast(err.message || 'Failed to disconnect Fireflies', 'error');
    } finally {
      setDisconnectingFireflies(false);
    }
  };

  const isCalConnected = Boolean(calendarStatus?.connected && calendarStatus?.calendar_scope_granted);
  const isFirefliesConnected = Boolean(firefliesStatus?.connected);

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-8 space-y-6">
      <div className="pb-4 border-b border-slate-200">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Integrations</h1>
        <p className="text-xs text-slate-500 mt-0.5">Connect services used by this workspace.</p>
      </div>

      <div className="space-y-4">
        <div className="p-6 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 text-brand-gradient flex items-center justify-center shrink-0"><Video className="w-6 h-6" /></div>
              <div className="space-y-1">
                <h3 className="text-base font-semibold text-slate-900">Google Meet</h3>
                <p className="text-xs text-slate-500 max-w-xl leading-relaxed">Used exclusively for meeting capture and transcript import.</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleConnectMeet} loading={connectingMeet} icon={Link2}>Connect Google</Button>
          </div>
        </div>

        <div className="p-6 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-500 flex items-center justify-center shrink-0">
                <Flame className="w-6 h-6" />
              </div>

              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-slate-900">Fireflies.ai</h3>
                  {isFirefliesConnected && <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md"><CheckCircle2 className="w-3.5 h-3.5" />Connected</span>}
                </div>
                <p className="text-xs text-slate-500 max-w-xl leading-relaxed">Import your Fireflies transcripts into this workspace. MOM Creator checks connected workspaces approximately once per hour, and you can also refresh manually from the dashboard when the hourly limit allows it.</p>
                {isFirefliesConnected && firefliesStatus?.fireflies_user_email && (
                  <p className="text-[11px] text-slate-400">
                    Connected account: {firefliesStatus.fireflies_user_email}
                  </p>
                )}
              </div>
            </div>
          </div>

          {!isFirefliesConnected ? (
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="password"
                value={firefliesKey}
                onChange={(e) => setFirefliesKey(e.target.value)}
                placeholder="Paste Fireflies API key"
                className="flex-1 min-w-0 px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
              />
              <Button size="sm" onClick={handleConnectFireflies} loading={connectingFireflies} icon={Link2}>Connect Fireflies</Button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
              <p className="text-[11px] text-slate-500">Meetings are imported into <span className="font-semibold text-slate-700">{currentWorkspace?.name}</span> only.</p>
              <Button variant="outline" size="sm" onClick={handleDisconnectFireflies} loading={disconnectingFireflies} icon={Unplug}>Disconnect</Button>
            </div>
          )}
        </div>

        <div className="p-6 rounded-xl border border-slate-200 bg-white shadow-2xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${isCalConnected ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}><Calendar className="w-6 h-6" /></div>
              <div className="space-y-1">
                <div className="flex items-center gap-2"><h3 className="text-base font-semibold text-slate-900">Google Calendar</h3>{isCalConnected && <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md"><CheckCircle2 className="w-3.5 h-3.5" />Connected</span>}</div>
                <p className="text-xs text-slate-500 max-w-xl leading-relaxed">Used for scheduling action items to your calendar.</p>
              </div>
            </div>
            <Button variant={isCalConnected ? 'secondary' : 'primary'} size="sm" onClick={handleConnectCalendar} loading={connectingCal} icon={Link2}>{isCalConnected ? 'Reconnect' : 'Connect Calendar'}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, ArrowRight, Video, Calendar, ShieldCheck, AlertTriangle } from 'lucide-react';
import { Button } from '../components/common/Button.jsx';
import { getGoogleCalendarStatus } from '../services/googleCalendar.js';

export function GoogleCallbackPage({ onNavigate }) {
  const [status, setStatus] = useState('loading');
  const [verifiedStatus, setVerifiedStatus] = useState(null);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const s = params.get('status') || 'unknown';
    setStatus(s);

    // After redirect from Google OAuth callback, re-check actual Google integration status from backend
    getGoogleCalendarStatus()
      .then((res) => {
        setVerifiedStatus(res);
      })
      .catch((err) => {
        console.warn('Status verify error:', err);
      })
      .finally(() => {
        setChecking(false);
      });
  }, []);

  const isSuccess = status === 'connected';
  const hasCalendarScope = Boolean(verifiedStatus?.connected && verifiedStatus?.calendar_scope_granted);

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-slate-50">
      <div className="w-full max-w-md bg-white rounded-xl border border-slate-200 p-8 shadow-xs text-center space-y-5">
        <div
          className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto ${
            isSuccess ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
          }`}
        >
          {isSuccess ? <CheckCircle2 className="w-8 h-8" /> : <AlertCircle className="w-8 h-8" />}
        </div>

        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            {isSuccess ? 'Google Account Connected' : 'Google Authorization Notice'}
          </h2>
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
            {isSuccess
              ? 'Your Google OAuth authorization was processed by the backend.'
              : status === 'denied'
              ? 'Authorization request was declined by the user.'
              : `OAuth callback status: ${status}. Please try connecting again from Integrations.`}
          </p>
        </div>

        {isSuccess && (
          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-left space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-slate-700 font-medium">
                <Video className="w-4 h-4 text-indigo-600" />
                <span>Google Meet</span>
              </div>
              <span className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                Ready
              </span>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
              <div className="flex items-center gap-2 text-slate-700 font-medium">
                <Calendar className="w-4 h-4 text-indigo-600" />
                <span>Google Calendar</span>
              </div>
              {checking ? (
                <span className="text-[11px] text-slate-400">Verifying...</span>
              ) : hasCalendarScope ? (
                <span className="text-[11px] font-semibold text-emerald-700 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  Granted
                </span>
              ) : (
                <span className="text-[11px] font-semibold text-amber-700 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-amber-600" />
                  Scope not granted
                </span>
              )}
            </div>
          </div>
        )}

        <div className="pt-2">
          <Button
            onClick={() => onNavigate('/dashboard')}
            icon={ArrowRight}
            className="w-full"
          >
            Continue to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}

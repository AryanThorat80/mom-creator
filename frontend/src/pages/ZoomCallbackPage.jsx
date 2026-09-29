import { CheckCircle2, AlertCircle, ArrowRight, Video } from 'lucide-react';
import { Button } from '../components/common/Button.jsx';

export function ZoomCallbackPage({ onNavigate }) {
  const params = new URLSearchParams(window.location.search);
  const status = params.get('status') || 'unknown';
  const isSuccess = status === 'connected';

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-slate-50">
      <div className="w-full max-w-md bg-white rounded-xl border border-slate-200 p-8 shadow-xs text-center space-y-5">
        <div className={`w-14 h-14 rounded-full flex items-center justify-center mx-auto ${isSuccess ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
          {isSuccess ? <CheckCircle2 className="w-8 h-8" /> : <AlertCircle className="w-8 h-8" />}
        </div>

        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            {isSuccess ? 'Zoom Connected' : 'Zoom Authorization Notice'}
          </h2>
          <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
            {isSuccess
              ? 'Your Zoom account is connected and can be used to create online meetings.'
              : 'The Zoom authorization was not completed. Please try connecting again from Integrations.'}
          </p>
        </div>

        {isSuccess && (
          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-xs text-left">
            <div className="flex items-center gap-2 text-slate-700 font-medium">
              <Video className="w-4 h-4 text-indigo-600" />
              <span>Zoom</span>
              <span className="ml-auto text-[11px] font-semibold text-emerald-700 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Ready
              </span>
            </div>
          </div>
        )}

        <Button onClick={() => onNavigate('/dashboard')} icon={ArrowRight} className="w-full">
          Continue to Dashboard
        </Button>
      </div>
    </div>
  );
}

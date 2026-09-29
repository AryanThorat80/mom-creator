import { useState } from 'react';
import { CheckCircle2, AlertCircle, ChevronDown, ChevronUp, RotateCcw } from 'lucide-react';
import { Button } from '../common/Button.jsx';

export function ProcessingProgress({
  stage = 'idle', // 'uploading' | 'transcribing' | 'generating_mom' | 'completed' | 'failed'
  error = null,
  onRetry,
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);

  const steps = [
    { key: 'upload', label: 'Recording uploaded' },
    { key: 'transcription', label: 'Transcription processing' },
    { key: 'mom_generation', label: 'MOM & Action Items generated' },
    { key: 'completed', label: 'Ready for review' },
  ];

  const getStepState = (stepKey) => {
    if (stage === 'failed') {
      return 'failed';
    }
    if (stage === 'completed') {
      return 'done';
    }

    if (stage === 'uploading') {
      if (stepKey === 'upload') return 'active';
      return 'pending';
    }
    if (stage === 'transcribing') {
      if (stepKey === 'upload') return 'done';
      if (stepKey === 'transcription') return 'active';
      return 'pending';
    }
    if (stage === 'generating_mom') {
      if (stepKey === 'upload' || stepKey === 'transcription') return 'done';
      if (stepKey === 'mom_generation') return 'active';
      return 'pending';
    }

    return 'pending';
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div>
          <h4 className="text-sm font-semibold text-slate-900">
            {stage === 'failed'
              ? 'Processing Encountered an Issue'
              : stage === 'completed'
              ? 'Processing Complete'
              : 'Processing Meeting Content'}
          </h4>
          <p className="text-xs text-slate-500 mt-0.5">
            {stage === 'uploading' && 'Uploading recording to private workspace storage...'}
            {stage === 'transcribing' && 'FastAPI worker is transcribing primary audio recording...'}
            {stage === 'generating_mom' && 'Generating executive summary, decisions, and action items...'}
            {stage === 'completed' && 'Minutes of Meeting have been created and are ready.'}
            {stage === 'failed' && 'The worker was unable to complete the current job.'}
          </p>
        </div>

        {stage === 'failed' && onRetry && (
          <Button size="sm" variant="secondary" onClick={onRetry} icon={RotateCcw}>
            Retry
          </Button>
        )}
      </div>

      {/* Step Indicators */}
      <div className="space-y-3 pt-1">
        {steps.map((st) => {
          const state = getStepState(st.key);
          return (
            <div key={st.key} className="flex items-center gap-3 text-xs">
              {state === 'done' ? (
                <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                </div>
              ) : state === 'active' ? (
                <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
                  <span className="w-2 h-2 rounded-full bg-indigo-600 animate-ping" />
                </div>
              ) : (
                <div className="w-5 h-5 rounded-full border border-slate-300 bg-white flex items-center justify-center shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                </div>
              )}

              <span
                className={`font-medium ${
                  state === 'done'
                    ? 'text-slate-800'
                    : state === 'active'
                    ? 'text-indigo-700 font-semibold'
                    : 'text-slate-400'
                }`}
              >
                {st.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Error Details */}
      {error && (
        <div className="mt-4 pt-3 border-t border-slate-100">
          <div className="flex items-start justify-between text-xs text-rose-700 bg-rose-50 p-3 rounded-lg border border-rose-200">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Processing error</p>
                <p className="text-slate-600 mt-0.5">{error}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDetailsOpen(!detailsOpen)}
              className="text-slate-400 hover:text-slate-700 ml-2"
            >
              {detailsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

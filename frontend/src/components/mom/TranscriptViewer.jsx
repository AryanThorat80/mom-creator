import { useState } from 'react';
import { FileText, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import { Button } from '../common/Button.jsx';
import { useToast } from '../../context/ToastContext.jsx';

export function TranscriptViewer({ transcript = '' }) {
  const { showToast } = useToast();
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!transcript || !transcript.trim()) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-5 text-center text-xs text-slate-400 italic">
        No transcript available for this meeting yet.
      </div>
    );
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(transcript);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    showToast('Transcript copied to clipboard', 'info');
  };

  // Clean lines for presentation
  const lines = transcript
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const displayedLines = isExpanded ? lines : lines.slice(0, 10);

  return (
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden space-y-0">
      <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 bg-white">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-900 tracking-tight">Meeting Transcript</h3>
          <span className="text-xs text-slate-400 font-mono tabular-nums">
            ({lines.length} lines)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopy}
            icon={copied ? Check : Copy}
          >
            {copied ? 'Copied' : 'Copy'}
          </Button>
          {lines.length > 10 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              icon={isExpanded ? ChevronUp : ChevronDown}
            >
              {isExpanded ? 'Collapse' : 'Show All'}
            </Button>
          )}
        </div>
      </div>

      <div className="p-5 font-mono text-xs text-slate-700 bg-slate-50/50 space-y-2.5 max-h-[500px] overflow-y-auto leading-relaxed selection:bg-indigo-100">
        {displayedLines.map((line, idx) => {
          // Check if line looks like "Speaker: ..." or "Timestamp Speaker: ..."
          const match = line.match(/^(\[?[\d:]+\]?\s+)?([A-Za-z0-9\s._-]+):(.*)$/);
          if (match) {
            const time = match[1]?.trim();
            const speaker = match[2]?.trim();
            const speech = match[3]?.trim();
            return (
              <div key={idx} className="pb-1">
                <div className="flex items-center gap-2 text-[11px] font-semibold text-indigo-900">
                  {time && <span className="text-slate-400 font-normal">{time}</span>}
                  <span>{speaker}</span>
                </div>
                <p className="text-slate-700 pl-0 mt-0.5">{speech}</p>
              </div>
            );
          }

          return (
            <p key={idx} className="text-slate-700">
              {line}
            </p>
          );
        })}

        {!isExpanded && lines.length > 10 && (
          <div className="pt-2 text-center border-t border-slate-200">
            <button
              type="button"
              onClick={() => setIsExpanded(true)}
              className="text-xs font-semibold text-brand-gradient hover:text-indigo-700 cursor-pointer"
            >
              + Show {lines.length - 10} more lines
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

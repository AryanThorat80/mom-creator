import { Plus, X } from 'lucide-react';
import { Button } from '../common/Button.jsx';

export function AbbreviationsEditor({
  abbreviations = {},
  onChange,
  isEditing = false,
}) {
  const entries = Object.entries(abbreviations || {});

  const handleUpdate = (oldKey, newKey, newVal) => {
    const next = { ...abbreviations };
    if (oldKey !== newKey) {
      delete next[oldKey];
    }
    if (newKey) {
      next[newKey] = newVal;
    }
    onChange(next);
  };

  const handleAdd = () => {
    const next = { ...abbreviations, '': '' };
    onChange(next);
  };

  const handleRemove = (keyToRemove) => {
    const next = { ...abbreviations };
    delete next[keyToRemove];
    onChange(next);
  };

  if (!isEditing) {
    if (entries.length === 0) {
      return <p className="text-xs text-slate-400 italic">No abbreviations noted.</p>;
    }
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
        {entries.map(([abbr, full]) => (
          <div key={abbr} className="flex items-baseline gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100">
            <span className="font-mono font-semibold text-slate-800 shrink-0">{abbr}:</span>
            <span className="text-slate-600">{full}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {entries.map(([abbr, full], idx) => (
        <div key={idx} className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Abbr (e.g. ROI)"
            value={abbr}
            onChange={(e) => handleUpdate(abbr, e.target.value, full)}
            className="w-28 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
          />
          <span className="text-slate-400">:</span>
          <input
            type="text"
            placeholder="Definition (e.g. Return on Investment)"
            value={full}
            onChange={(e) => handleUpdate(abbr, abbr, e.target.value)}
            className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600"
          />
          <button
            type="button"
            onClick={() => handleRemove(abbr)}
            className="p-1.5 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
            aria-label="Remove abbreviation"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}

      <Button
        variant="ghost"
        size="sm"
        onClick={handleAdd}
        icon={Plus}
        className="text-xs text-indigo-600 hover:text-indigo-700"
      >
        Add Abbreviation
      </Button>
    </div>
  );
}

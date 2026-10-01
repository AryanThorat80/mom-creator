import { Plus, X } from 'lucide-react';
import { Button } from '../common/Button.jsx';

export function ListFieldEditor({
  items = [],
  onChange,
  isEditing = false,
  placeholder = 'Add new item...',
  addLabel = 'Add point',
}) {
  const handleItemChange = (index, value) => {
    const updated = [...items];
    updated[index] = value;
    onChange(updated);
  };

  const handleAddItem = () => {
    onChange([...items, '']);
  };

  const handleRemoveItem = (index) => {
    const updated = items.filter((_, i) => i !== index);
    onChange(updated);
  };

  if (!isEditing) {
    if (!items || items.length === 0) {
      return <p className="text-xs text-slate-400 italic">No items recorded.</p>;
    }
    return (
      <ul className="space-y-2 text-sm text-slate-700">
        {items.map((item, idx) => (
          <li key={idx} className="flex items-start gap-2.5 leading-relaxed">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-gradient mt-2 shrink-0" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="space-y-2.5">
      {items.map((item, idx) => (
        <div key={idx} className="flex items-start gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-3 shrink-0" />
          <textarea
            rows={1}
            value={item}
            onChange={(e) => handleItemChange(idx, e.target.value)}
            placeholder={placeholder}
            className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-brand-gradient transition-colors resize-y"
          />
          <button
            type="button"
            onClick={() => handleRemoveItem(idx)}
            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors mt-0.5 cursor-pointer"
            aria-label="Remove item"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}

      <Button
        variant="ghost"
        size="sm"
        onClick={handleAddItem}
        icon={Plus}
        className="text-xs text-brand-gradient hover:text-indigo-700 hover:bg-indigo-50/50"
      >
        {addLabel}
      </Button>
    </div>
  );
}

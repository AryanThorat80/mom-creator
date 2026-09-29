import { useState, useRef, useEffect } from 'react';
import { useWorkspace } from '../../context/WorkspaceContext.jsx';
import { Building2, ChevronDown, Check, Plus, Settings } from 'lucide-react';

export function WorkspaceSelector({ onOpenCreate, onOpenSettings }) {
  const { workspaces, currentWorkspace, setCurrentWorkspace, loading } = useWorkspace();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={loading}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors cursor-pointer group"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-6 h-6 rounded-md bg-indigo-600/10 text-indigo-600 flex items-center justify-center shrink-0">
            <Building2 className="w-3.5 h-3.5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
              Workspace
            </p>
            <p className="text-xs font-semibold text-slate-800 truncate">
              {currentWorkspace ? currentWorkspace.name : loading ? 'Loading...' : 'Select Workspace'}
            </p>
          </div>
        </div>
        <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-slate-600 shrink-0 transition-transform" />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1.5 z-40 bg-white rounded-lg border border-slate-200 shadow-lg py-1.5 animate-in fade-in zoom-in-95 duration-100">
          <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Your Workspaces
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                type="button"
                onClick={() => {
                  setCurrentWorkspace(ws);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs font-medium transition-colors text-left cursor-pointer ${
                  currentWorkspace?.id === ws.id
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className="truncate">{ws.name}</span>
                {currentWorkspace?.id === ws.id && (
                  <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0 ml-2" />
                )}
              </button>
            ))}

            {workspaces.length === 0 && !loading && (
              <div className="px-3 py-2 text-xs text-slate-400 italic">
                No workspaces found
              </div>
            )}
          </div>

          <div className="pt-1 mt-1 border-t border-slate-100">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onOpenCreate();
              }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-indigo-600 hover:bg-indigo-50/50 font-medium transition-colors cursor-pointer text-left"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Create New Workspace</span>
            </button>
            {currentWorkspace && onOpenSettings && (
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onOpenSettings();
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 font-medium transition-colors cursor-pointer text-left"
              >
                <Settings className="w-3.5 h-3.5 text-slate-400" />
                <span>Workspace Settings</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

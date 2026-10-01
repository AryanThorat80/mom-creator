import { Menu, Plus, Video, Calendar } from 'lucide-react';
import { Button } from '../common/Button.jsx';
import { useWorkspace } from '../../context/WorkspaceContext.jsx';

export function Header({
  onToggleMobileMenu,
  breadcrumbs = [],
  onOpenCreateMeeting,
}) {
  const { currentWorkspace } = useWorkspace();

  return (
    <header className="h-14 px-4 sm:px-6 bg-white border-b border-slate-200 flex items-center justify-between gap-4 shrink-0">
      {/* Zone 1: Mobile toggle & Breadcrumbs */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onToggleMobileMenu}
          className="md:hidden p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs text-slate-500 truncate">
          <span className="font-semibold text-slate-700 hidden sm:inline">
            {currentWorkspace ? currentWorkspace.name : 'Workspace'}
          </span>
          {breadcrumbs.map((crumb, idx) => (
            <div key={idx} className="flex items-center gap-1.5 truncate">
              <span className="text-slate-300">/</span>
              {crumb.onClick ? (
                <button
                  type="button"
                  onClick={crumb.onClick}
                  className="hover:text-slate-900 truncate font-medium cursor-pointer"
                >
                  {crumb.label}
                </button>
              ) : (
                <span className="text-slate-800 font-semibold truncate">{crumb.label}</span>
              )}
            </div>
          ))}
        </nav>
      </div>
    </header>
  );
}

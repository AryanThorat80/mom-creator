import {
  LayoutDashboard,
  CalendarDays,
  Building2,
  Link2,
  Settings,
  LogOut,
  Activity,
  ShieldCheck,
  FileText,
} from 'lucide-react';
import { WorkspaceSelector } from '../workspace/WorkspaceSelector.jsx';
import { useAuth } from '../../context/AuthContext.jsx';

export function Sidebar({
  currentPath,
  onNavigate,
  onOpenCreateWorkspace,
  onOpenWorkspaceSettings,
  isMobile = false,
  onCloseMobile,
}) {
  const { user, profile, signOut } = useAuth();

  const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Meetings', path: '/meetings', icon: CalendarDays },
    { label: 'Workspaces', path: '/workspaces', icon: Building2 },
    { label: 'Integrations', path: '/integrations', icon: Link2 },
    { label: 'API & Diagnostics', path: '/settings', icon: Activity },
    { label: 'Privacy Policy', path: '/privacy', icon: ShieldCheck },
    { label: 'Terms of Service', path: '/terms', icon: FileText },
  ];

  const handleNav = (path) => {
    onNavigate(path);
    if (isMobile && onCloseMobile) {
      onCloseMobile();
    }
  };

  return (
    <aside className="w-64 h-full flex flex-col bg-white border-r border-slate-200 select-none">
      {/* Brand Zone */}
      <div className="h-14 px-5 flex items-center gap-2.5 border-b border-slate-100">
        <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-sm tracking-tight shadow-xs">
          M
        </div>
        <span className="text-base font-bold text-slate-900 tracking-tight">
          MOM Creator
        </span>
      </div>

      {/* Workspace Selector */}
      <div className="p-3 border-b border-slate-100">
        <WorkspaceSelector
          onOpenCreate={onOpenCreateWorkspace}
          onOpenSettings={onOpenWorkspaceSettings}
        />
      </div>

      {/* Primary Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Menu
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPath === item.path || (item.path !== '/dashboard' && currentPath.startsWith(item.path));
          return (
            <button
              key={item.path}
              type="button"
              onClick={() => handleNav(item.path)}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors cursor-pointer text-left ${
                isActive
                  ? 'bg-indigo-50 text-indigo-700 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-indigo-600' : 'text-slate-400'}`} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* User profile & actions */}
      <div className="p-3 border-t border-slate-100 bg-slate-50/50">
        <div className="flex items-center justify-between gap-2 px-2 py-1.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-semibold text-xs shrink-0">
              {profile?.name ? profile.name[0].toUpperCase() : user?.email ? user.email[0].toUpperCase() : 'U'}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-800 truncate">
                {profile?.name || user?.email?.split('@')[0] || 'User'}
              </p>
              <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={signOut}
            title="Sign out"
            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer shrink-0"
            aria-label="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}

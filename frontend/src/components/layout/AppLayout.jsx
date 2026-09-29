import { useState } from 'react';
import { Sidebar } from './Sidebar.jsx';
import { Header } from './Header.jsx';
import { CreateWorkspaceModal } from '../workspace/CreateWorkspaceModal.jsx';
import { WorkspaceSettingsModal } from '../workspace/WorkspaceSettingsModal.jsx';

export function AppLayout({
  currentPath,
  onNavigate,
  breadcrumbs = [],
  onOpenCreateMeeting,
  children,
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [createWorkspaceOpen, setCreateWorkspaceOpen] = useState(false);
  const [workspaceSettingsOpen, setWorkspaceSettingsOpen] = useState(false);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 text-slate-900 font-sans">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex shrink-0">
        <Sidebar
          currentPath={currentPath}
          onNavigate={onNavigate}
          onOpenCreateWorkspace={() => setCreateWorkspaceOpen(true)}
          onOpenWorkspaceSettings={() => setWorkspaceSettingsOpen(true)}
        />
      </div>

      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-xs md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="w-64 h-full shadow-2xl animate-in slide-in-from-left duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <Sidebar
              currentPath={currentPath}
              onNavigate={onNavigate}
              onOpenCreateWorkspace={() => {
                setMobileMenuOpen(false);
                setCreateWorkspaceOpen(true);
              }}
              onOpenWorkspaceSettings={() => {
                setMobileMenuOpen(false);
                setWorkspaceSettingsOpen(true);
              }}
              isMobile
              onCloseMobile={() => setMobileMenuOpen(false)}
            />
          </div>
        </div>
      )}

      {/* Main Viewport */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <Header
          onToggleMobileMenu={() => setMobileMenuOpen(true)}
          breadcrumbs={breadcrumbs}
          onOpenCreateMeeting={onOpenCreateMeeting}
        />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* Workspace Modals */}
      <CreateWorkspaceModal
        isOpen={createWorkspaceOpen}
        onClose={() => setCreateWorkspaceOpen(false)}
      />
      <WorkspaceSettingsModal
        isOpen={workspaceSettingsOpen}
        onClose={() => setWorkspaceSettingsOpen(false)}
      />
    </div>
  );
}

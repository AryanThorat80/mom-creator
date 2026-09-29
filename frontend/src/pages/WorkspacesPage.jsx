import { useState } from 'react';
import { Building2, Plus, Settings } from 'lucide-react';

import { Button } from '../components/common/Button.jsx';
import { CreateWorkspaceModal } from '../components/workspace/CreateWorkspaceModal.jsx';
import { WorkspaceSettingsModal } from '../components/workspace/WorkspaceSettingsModal.jsx';
import { WorkspaceMembers } from '../components/workspace/WorkspaceMembers.jsx';

import { useWorkspace } from '../context/WorkspaceContext.jsx';

export function WorkspacesPage() {
  const {
    workspaces,
    currentWorkspace,
    setCurrentWorkspace,
    loading,
  } = useWorkspace();

  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';

    try {
      return new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(new Date(dateStr));
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-8 space-y-6">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">

        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Workspaces
          </h1>

          <p className="text-xs text-slate-500 mt-0.5">
            Manage your team workspaces and customized terminologies.
          </p>
        </div>

        <Button
          onClick={() => setCreateModalOpen(true)}
          icon={Plus}
        >
          New Workspace
        </Button>

      </div>

      {/* Workspace cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {workspaces.map((ws) => {
          const isSelected = currentWorkspace?.id === ws.id;

          return (
            <div
              key={ws.id}
              className={`p-5 rounded-xl border transition-all ${
                isSelected
                  ? 'border-indigo-600 bg-white ring-1 ring-indigo-600 shadow-2xs'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >

              <div className="flex items-start justify-between gap-3">

                {/* Workspace identity */}
                <div className="flex items-center gap-3">

                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                      isSelected
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    <Building2 className="w-5 h-5" />
                  </div>

                  <div>

                    <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">

                      <span>{ws.name}</span>

                      {isSelected && (
                        <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">
                          Active
                        </span>
                      )}

                    </h3>

                    <p className="text-[11px] text-slate-500 font-mono tabular-nums mt-0.5">
                      Created {formatDate(ws.created_at)}
                    </p>

                  </div>

                </div>

                {/* Workspace actions */}
                {isSelected ? (
                  <button
                    type="button"
                    onClick={() => setSettingsModalOpen(true)}
                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                    title="Workspace settings"
                  >
                    <Settings className="w-4 h-4" />
                  </button>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setCurrentWorkspace(ws)}
                  >
                    Switch
                  </Button>
                )}

              </div>

            </div>
          );
        })}

      </div>

      {/* =====================================================
          CURRENT WORKSPACE MEMBERS
          ===================================================== */}

      {currentWorkspace && (
        <>
          <WorkspaceMembers />

          <button
            type="button"
            onClick={() => {
              window.history.pushState({}, '', '/members');
              window.dispatchEvent(new PopStateEvent('popstate'));
            }}
            className="mt-4 inline-flex items-center justify-center px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition-colors"
          >
            Manage Members
          </button>
        </>
      )}

      


      {/* Modals */}
      <CreateWorkspaceModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
      />

      <WorkspaceSettingsModal
        isOpen={settingsModalOpen}
        onClose={() => setSettingsModalOpen(false)}
      />

    </div>
  );
}
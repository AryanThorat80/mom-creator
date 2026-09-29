import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthContext.jsx';
import { listWorkspaces, createWorkspace as apiCreateWorkspace } from '../services/workspaces.js';

const WorkspaceContext = createContext(null);

export function WorkspaceProvider({ children }) {
  const { session } = useAuth();

  const [workspaces, setWorkspaces] = useState([]);
  const [currentWorkspace, setCurrentWorkspaceState] = useState(null);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState(null);

  const selectWorkspace = useCallback((ws) => {
    setCurrentWorkspaceState(ws);

    if (ws?.id) {
      localStorage.setItem('mom_active_workspace_id', ws.id);
    } else {
      localStorage.removeItem('mom_active_workspace_id');
    }
  }, []);

  const refreshWorkspaces = useCallback(async (selectId = null) => {
    if (!session) {
      setWorkspaces([]);
      setCurrentWorkspaceState(null);
      setInitialized(true);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await listWorkspaces();
      const list = Array.isArray(data) ? data : [];

      setWorkspaces(list);

      const savedId =
        selectId || localStorage.getItem('mom_active_workspace_id');

      const found = list.find((w) => w.id === savedId);

      if (found) {
        selectWorkspace(found);
      } else if (list.length > 0) {
        selectWorkspace(list[0]);
      } else {
        selectWorkspace(null);
      }
    } catch (err) {
      console.error('Failed to load workspaces:', err);
      setError(err.message || 'Failed to load workspaces');
    } finally {
      setLoading(false);
      setInitialized(true);
    }
  }, [session, selectWorkspace]);

  useEffect(() => {
    if (session) {
      setInitialized(false);
      refreshWorkspaces();
    } else {
      setWorkspaces([]);
      setCurrentWorkspaceState(null);
      setInitialized(true);
    }
  }, [session, refreshWorkspaces]);

  const createWorkspace = async ({ name, terminology = {} }) => {
    const newWs = await apiCreateWorkspace({
      name,
      terminology,
    });

    await refreshWorkspaces(newWs.id);

    return newWs;
  };

  return (
    <WorkspaceContext.Provider
      value={{
        workspaces,
        currentWorkspace,
        setCurrentWorkspace: selectWorkspace,
        loading,
        initialized,
        error,
        refreshWorkspaces,
        createWorkspace,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);

  if (!context) {
    throw new Error('useWorkspace must be used within a WorkspaceProvider');
  }

  return context;
}
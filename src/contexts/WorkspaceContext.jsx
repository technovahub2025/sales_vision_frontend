import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api/auth.api';
import { projectsApi } from '../api';
import { ROUTES } from '../routes/routePaths';
import { useAuth } from './AuthContext';

const WorkspaceContext = createContext(null);
const STORAGE_KEYS = {
  workspaceId: 'salesvision:workspaceId',
  projectId: 'salesvision:projectId',
  legacyWorkspaceId: 'salevision:workspaceId',
  legacyProjectId: 'salevision:projectId',
};

function readStorage(key, legacyKey) {
  return window.localStorage.getItem(key) || (legacyKey ? window.localStorage.getItem(legacyKey) : '') || '';
}

function writeStorage(key, legacyKey, value) {
  window.localStorage.setItem(key, value);
  if (legacyKey) {
    window.localStorage.setItem(legacyKey, value);
  }
}

function clearStorage(key, legacyKey) {
  window.localStorage.removeItem(key);
  if (legacyKey) {
    window.localStorage.removeItem(legacyKey);
  }
}

function normalizeMemberships(list) {
  return (list || [])
    .map((item) => {
      const workspace = item?.workspace || null;
      const workspaceId = String(item?.workspaceId || workspace?._id || workspace?.id || item?._id || item?.id || '');
      if (!workspaceId) return null;
      return {
        ...item,
        workspaceId,
        workspace,
        role: String(item?.role || item?.workspaceRole || workspace?.role || ''),
      };
    })
    .filter(Boolean);
}

function readProjectId() {
  return readStorage(STORAGE_KEYS.projectId, STORAGE_KEYS.legacyProjectId);
}

function isWorkspaceScopedKey(queryKey, workspaceId) {
  if (!workspaceId) return false;
  if (!Array.isArray(queryKey)) return false;
  return queryKey.some((part) => String(part) === String(workspaceId));
}

export function WorkspaceProvider({ children }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, isAuthenticated, session, memberships: authMemberships, defaultWorkspaceId } = useAuth();
  const [workspaceId, setWorkspaceId] = useState('');
  const [bootstrapStatus, setBootstrapStatus] = useState('booting');
  const [bootstrapError, setBootstrapError] = useState('');
  const [projectId, setProjectIdState] = useState(readProjectId);
  const [isOnboarding, setIsOnboarding] = useState(false);
  const hasAttemptedRecovery = useRef(false);

  const userId = String(user?._id || user?.id || '');
  // Fix: Ensure workspaceId is actually set before marking as ready
  const workspaceReady = bootstrapStatus === 'ready' && Boolean(workspaceId);
  const effectiveWorkspaceId = workspaceReady ? workspaceId : '';

  const membershipsQuery = useQuery({
    queryKey: ['memberships', userId || 'current'],
    queryFn: async () => {
      const payload = await authApi.me();
      const memberships = payload?.data?.memberships || payload?.data?.user?.memberships || [];
      return {
        memberships: normalizeMemberships(memberships),
        userWorkspaceId: String(payload?.data?.user?.workspaceId || ''),
      };
    },
    enabled: Boolean(isAuthenticated),
    staleTime: 60_000,
    gcTime: 5 * 60_000,
  });

  const sessionMemberships = useMemo(() => normalizeMemberships(authMemberships), [authMemberships]);
  const membershipsFromQuery = membershipsQuery.data?.memberships || [];
  const memberships = membershipsFromQuery.length ? membershipsFromQuery : sessionMemberships;
  const userWorkspaceId = String(
    membershipsQuery.data?.userWorkspaceId ||
      session?.user?.workspaceId ||
      user?.workspaceId ||
      defaultWorkspaceId ||
      '',
  );
  const workspaces = useMemo(
    () =>
      memberships.map((membership) => ({
        ...(membership.workspace || {}),
        id: membership.workspaceId,
        role: membership.role,
        name: membership.workspace?.name || membership.name || 'Workspace',
      })),
    [memberships],
  );

  useEffect(() => {
    if (!isAuthenticated) {
      setWorkspaceId('');
      setIsOnboarding(false);
      setBootstrapStatus('booting');
      setBootstrapError('');
      return;
    }

    if (membershipsQuery.isError) {
      setWorkspaceId('');
      setIsOnboarding(false);
      setBootstrapStatus('error');
      setBootstrapError(membershipsQuery.error?.message || 'Failed to load workspace memberships.');
      return;
    }

    if (!membershipsQuery.isFetched) {
      setBootstrapStatus('booting');
      return;
    }

    if (!memberships.length) {
      if (userWorkspaceId) {
        setWorkspaceId(userWorkspaceId);
        setIsOnboarding(false);
        setBootstrapStatus('ready');
        setBootstrapError('');
        writeStorage(STORAGE_KEYS.workspaceId, STORAGE_KEYS.legacyWorkspaceId, userWorkspaceId);
        return;
      }
      setWorkspaceId('');
      setIsOnboarding(true);
      setBootstrapStatus('empty_membership');
      setBootstrapError('No active workspace membership was found for this account.');
      navigate(ROUTES.onboarding, { replace: true });
      return;
    }

    setIsOnboarding(false);
    setBootstrapError('');

    const storedWorkspaceId = readStorage(STORAGE_KEYS.workspaceId, STORAGE_KEYS.legacyWorkspaceId);
    const availableIds = new Set(memberships.map((item) => String(item.workspaceId)));

    if (storedWorkspaceId && availableIds.has(storedWorkspaceId)) {
      setWorkspaceId(storedWorkspaceId);
      setBootstrapStatus('ready');
      return;
    }
    if (storedWorkspaceId && !availableIds.has(storedWorkspaceId)) {
      clearStorage(STORAGE_KEYS.workspaceId, STORAGE_KEYS.legacyWorkspaceId);
    }

    const devDefaultId = String(import.meta.env.VITE_DEFAULT_WORKSPACE_ID || '');
    const devEnabled = import.meta.env.DEV === true && import.meta.env.VITE_ENABLE_DEFAULT_WORKSPACE === 'true';
    if (devEnabled && devDefaultId && availableIds.has(devDefaultId)) {
      console.warn('[WorkspaceContext] Using VITE_DEFAULT_WORKSPACE_ID - dev only.');
      setWorkspaceId(devDefaultId);
      writeStorage(STORAGE_KEYS.workspaceId, STORAGE_KEYS.legacyWorkspaceId, devDefaultId);
      setBootstrapStatus('ready');
      return;
    }

    const fallback = memberships[0]?.workspaceId || '';
    if (fallback) {
      setWorkspaceId(String(fallback));
      writeStorage(STORAGE_KEYS.workspaceId, STORAGE_KEYS.legacyWorkspaceId, String(fallback));
      setBootstrapStatus('ready');
      return;
    }

    setBootstrapStatus('error');
    setBootstrapError('Unable to resolve an active workspace.');
  }, [
    isAuthenticated,
    membershipsQuery.isFetched,
    membershipsQuery.isError,
    membershipsQuery.error,
    memberships,
    userWorkspaceId,
    navigate,
  ]);

  useEffect(() => {
    if (bootstrapStatus !== 'empty_membership' && bootstrapStatus !== 'error') {
      return;
    }
    let active = true;
    authApi
      .workspaceDiagnostics()
      .then((payload) => {
        if (!active) return;
        const data = payload?.data || {};
        if (data.status && data.status !== 'ready') {
          setBootstrapError(`Workspace bootstrap: ${data.status} (${data.reason || 'unknown'})`);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [bootstrapStatus]);

  const switchWorkspace = (nextWorkspaceId) => {
    const safe = String(nextWorkspaceId || '').trim();
    if (!safe || safe === workspaceId) return;
    const isAllowed = memberships.some((item) => String(item.workspaceId) === safe);
    if (!isAllowed) return;

    const previousWorkspaceId = workspaceId;
    setBootstrapStatus('booting');
    setWorkspaceId(safe);
    setProjectIdState('');
    writeStorage(STORAGE_KEYS.workspaceId, STORAGE_KEYS.legacyWorkspaceId, safe);
    clearStorage(STORAGE_KEYS.projectId, STORAGE_KEYS.legacyProjectId);
    setBootstrapStatus('ready');

    queryClient.removeQueries({
      predicate: (query) => isWorkspaceScopedKey(query.queryKey, previousWorkspaceId),
    });
    queryClient.invalidateQueries({
      predicate: (query) => Array.isArray(query.queryKey) && ['workspace', 'dashboard', 'task-board'].includes(String(query.queryKey[0] || '')),
    });
    navigate(ROUTES.dashboard);
  };

  const setProjectId = (nextProjectId) => {
    const safe = String(nextProjectId || '').trim();
    setProjectIdState(safe);
    if (safe) {
      writeStorage(STORAGE_KEYS.projectId, STORAGE_KEYS.legacyProjectId, safe);
    } else {
      clearStorage(STORAGE_KEYS.projectId, STORAGE_KEYS.legacyProjectId);
    }
  };

  useEffect(() => {
    hasAttemptedRecovery.current = false;
  }, [workspaceId]);

  useEffect(() => {
    if (!effectiveWorkspaceId || !projectId || hasAttemptedRecovery.current) {
      return;
    }

    let isMounted = true;
    const controller = new AbortController();

    async function validateProject() {
      try {
        await projectsApi.overview(effectiveWorkspaceId, projectId, controller.signal);
      } catch (err) {
        const status = Number(err?.status || 0);
        const code = String(err?.code || '');
        // Only clear projectId if not currently on a project board route (to prevent clearing valid route projectId on refresh)
        const currentPath = window.location.pathname;
        const basePath = (import.meta.env.BASE_URL || '/').replace(/\/$/, '');
        const normalizedPath =
          basePath && basePath !== '/' && currentPath.startsWith(basePath)
            ? currentPath.slice(basePath.length) || '/'
            : currentPath;
        const isProjectBoardRoute = /^\/projects\/[^/]+\/board/.test(normalizedPath);
        
        if (status !== 404 && code !== 'NOT_FOUND') {
          return;
        }

        // Don't clear projectId if we're on the project board route - let the route sync handle it
        if (isProjectBoardRoute) {
          console.warn('[WorkspaceContext] Skipping projectId recovery on project board route');
          return;
        }

        hasAttemptedRecovery.current = true;
        clearStorage(STORAGE_KEYS.projectId, STORAGE_KEYS.legacyProjectId);
        if (isMounted) {
          setProjectIdState('');
        }

        try {
          const listRes = await projectsApi.list(effectiveWorkspaceId, { page: 1, limit: 1 }, controller.signal);
          const first = listRes?.data?.[0];
          const nextProjectId = String(first?._id || first?.id || '');
          if (nextProjectId) {
            if (isMounted) {
              setProjectIdState(nextProjectId);
              writeStorage(STORAGE_KEYS.projectId, STORAGE_KEYS.legacyProjectId, nextProjectId);
            }
            return;
          }
        } catch (listError) {
          console.warn('[WorkspaceContext] recovery failed:', listError);
        }

        if (isMounted) {
          navigate('/projects', { replace: true });
        }
      }
    }

    validateProject();

    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [effectiveWorkspaceId, projectId, navigate]);

  const activeWorkspace = useMemo(
    () => workspaces.find((item) => String(item.id) === String(workspaceId)) || null,
    [workspaces, workspaceId],
  );

  const value = useMemo(
    () => ({
      workspaceId: effectiveWorkspaceId,
      selectedWorkspaceId: workspaceId,
      activeWorkspaceId: effectiveWorkspaceId,
      setWorkspaceId: switchWorkspace,
      switchWorkspace,
      memberships,
      workspaces,
      activeWorkspace,
      workspaceReady,
      bootstrapStatus,
      bootstrapError,
      isLoading: membershipsQuery.isLoading || membershipsQuery.isFetching || bootstrapStatus === 'booting',
      workspacesLoading: membershipsQuery.isLoading || membershipsQuery.isFetching || bootstrapStatus === 'booting',
      isOnboarding,
      projectId,
      setProjectId,
    }),
    [
      effectiveWorkspaceId,
      workspaceId,
      memberships,
      workspaces,
      activeWorkspace,
      workspaceReady,
      bootstrapStatus,
      bootstrapError,
      membershipsQuery.isLoading,
      membershipsQuery.isFetching,
      isOnboarding,
      projectId,
    ],
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);

  if (!context) {
    throw new Error('useWorkspace must be used within WorkspaceProvider');
  }

  return context;
}

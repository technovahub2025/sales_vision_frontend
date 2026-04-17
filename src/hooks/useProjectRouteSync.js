import { useLayoutEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useWorkspace } from '../contexts/WorkspaceContext';

export function useProjectRouteSync() {
  const { projectId: routeProjectId } = useParams();
  const { projectId, setProjectId } = useWorkspace();

  // Immediately sync route projectId to context on mount
  useLayoutEffect(() => {
    if (routeProjectId && String(routeProjectId) !== String(projectId)) {
      setProjectId(String(routeProjectId));
    }
  }, [routeProjectId, projectId, setProjectId]);

  // Always return route projectId if available, otherwise fall back to context projectId
  // This ensures the board uses the route projectId even if context sync is delayed
  return routeProjectId || projectId || '';
}

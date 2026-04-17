function normalizePath(path) {
  return String(path || '')
    .replace(/^\/*/, '')
    .replace(/\/*$/, '');
}

export function wsV1(workspaceId, path, options = {}) {
  if (!workspaceId) {
    throw new Error('wsV1: workspaceId is required');
  }
  const version = options.version || 'v1';
  const normalized = normalizePath(path);
  return `/${version}/workspaces/${workspaceId}/${normalized}`.replace(/\/$/, '');
}

/**
 * @deprecated Use wsV1 instead.
 */
export function ws(workspaceId, path) {
  if (!workspaceId) {
    throw new Error('ws: workspaceId is required');
  }
  const normalized = normalizePath(path);
  return `/workspaces/${workspaceId}/${normalized}`.replace(/\/$/, '');
}

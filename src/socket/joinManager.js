const joinRefs = new Map();

function stableStringify(value) {
  if (!value || typeof value !== 'object') {
    return JSON.stringify(value || null);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
    .join(',')}}`;
}

function payloadKey(payload) {
  return stableStringify({
    workspaceId: String(payload?.workspaceId || ''),
    projectId: String(payload?.projectId || ''),
    taskId: String(payload?.taskId || ''),
    userId: String(payload?.userId || ''),
    modules: Array.isArray(payload?.modules) ? payload.modules.map(String).sort() : [],
    entities: Array.isArray(payload?.entities) ? payload.entities : [],
  });
}

export function createJoinManager({ joinFn, leaveFn }) {
  return {
    join(payload) {
      const key = payloadKey(payload);
      const current = joinRefs.get(key) || 0;
      if (current === 0) {
        joinFn(payload);
      }
      joinRefs.set(key, current + 1);
      return key;
    },
    leave(payload) {
      const key = payloadKey(payload);
      const current = joinRefs.get(key) || 0;
      if (current <= 1) {
        joinRefs.delete(key);
        leaveFn(payload);
        return;
      }
      joinRefs.set(key, current - 1);
    },
  };
}

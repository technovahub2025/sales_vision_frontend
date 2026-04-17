export function toRealtimeEvent(input, fallbackEvent = '') {
  const payload = input && typeof input === 'object' ? input : {};
  const normalizedPayload = payload.payload || payload.data || payload.task || payload.comment || null;
  const event = String(payload.event || fallbackEvent || '');
  const entity = String(payload.entity || payload.entityType || '');
  const entityId = String(payload.entityId || normalizedPayload?._id || normalizedPayload?.id || '');
  const version = Number(payload.version || payload.meta?.version || Date.now());
  const ts = String(payload.ts || payload.timestamp || payload.meta?.at || new Date().toISOString());

  return {
    event,
    workspaceId: String(payload.workspaceId || normalizedPayload?.workspaceId || ''),
    entity,
    entityId,
    version,
    ts,
    payload: normalizedPayload,
    raw: payload,
  };
}

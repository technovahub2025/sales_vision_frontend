import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { clientsApi } from '../../api';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useSocket } from '../../contexts/SocketContext';
import { EVENTS } from '../../socket/events';
import { toRealtimeEvent } from '../../socket/realtime';

const statusLabel = (value, fallback) => {
  const raw = String(value || fallback || '').replaceAll('_', ' ').trim();
  if (!raw) return fallback;
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
};

const toneClass = (value) => {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'won' || normalized === 'active') return 'is-positive';
  if (normalized === 'lost' || normalized === 'archived') return 'is-negative';
  if (normalized === 'new' || normalized === 'todo') return 'is-neutral';
  return 'is-info';
};

function ClientDetailPage() {
  const { clientId } = useParams();
  const { workspaceId } = useWorkspace();
  const { socket, joinWorkspace, leaveWorkspace } = useSocket();
  const [client, setClient] = useState(null);
  const [leads, setLeads] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const hydrate = useCallback(async ({ silent = false } = {}) => {
    if (!workspaceId || !clientId) return;
    if (!silent) setLoading(true);
    setError('');
    try {
      const [clientRes, leadsRes, projectsRes] = await Promise.all([
        clientsApi.get(workspaceId, clientId),
        clientsApi.leads(workspaceId, clientId),
        clientsApi.projects(workspaceId, clientId),
      ]);
      setClient(clientRes.data || null);
      setLeads(leadsRes.data || []);
      setProjects(projectsRes.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load client detail');
    } finally {
      if (!silent) setLoading(false);
    }
  }, [workspaceId, clientId]);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!socket || !workspaceId) return undefined;
    const joinPayload = { workspaceId, modules: ['clients', 'projects', 'leads'] };
    joinWorkspace(joinPayload);

    const refreshSilent = () => hydrate({ silent: true });
    const onRealtime = (raw) => {
      const evt = toRealtimeEvent(raw);
      if (String(evt.workspaceId || '') !== String(workspaceId)) return;
      if (evt.entity === 'project' || evt.entity === 'lead' || evt.entity === 'client') {
        refreshSilent();
      }
    };

    socket.on(EVENTS.REALTIME_EVENT, onRealtime);
    socket.on(EVENTS.CLIENT_UPDATED, refreshSilent);
    socket.on(EVENTS.LEAD_UPDATED, refreshSilent);
    socket.on(EVENTS.LEAD_CREATED, refreshSilent);
    socket.on(EVENTS.PROJECT_UPDATED, refreshSilent);
    socket.on('project:created', refreshSilent);
    socket.on('project:deleted', refreshSilent);

    return () => {
      leaveWorkspace(joinPayload);
      socket.off(EVENTS.REALTIME_EVENT, onRealtime);
      socket.off(EVENTS.CLIENT_UPDATED, refreshSilent);
      socket.off(EVENTS.LEAD_UPDATED, refreshSilent);
      socket.off(EVENTS.LEAD_CREATED, refreshSilent);
      socket.off(EVENTS.PROJECT_UPDATED, refreshSilent);
      socket.off('project:created', refreshSilent);
      socket.off('project:deleted', refreshSilent);
    };
  }, [socket, workspaceId, joinWorkspace, leaveWorkspace, hydrate]);

  return (
    <main className="sv-client-page min-h-screen">
      <div className="sv-client-stack">
        {loading ? <p className="sv-client-state text-sm text-on-surface-variant">Loading client...</p> : null}
        {error ? <p className="sv-client-state is-error text-sm text-error">{error}</p> : null}
        {client ? (
          <>
            <section className="sv-card sv-client-header rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-6">
              <div className="sv-client-head-wrap flex items-center gap-4">
                <span className="sv-client-avatar inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
                  {String(client.name || 'CL').slice(0, 2).toUpperCase()}
                </span>
                <div className="sv-client-head-copy">
                  <h1 className="sv-client-title text-2xl font-semibold text-gray-900">{client.name}</h1>
                  <p className="sv-client-subtitle text-sm text-on-surface-variant">{client.industry || 'Industry not set'}</p>
                  <div className="sv-client-meta mt-2">
                    <span className="sv-client-meta-pill">{leads.length} linked leads</span>
                    <span className="sv-client-meta-pill">{projects.length} linked projects</span>
                    {client.email ? <span className="sv-client-meta-pill">{client.email}</span> : null}
                  </div>
                </div>
              </div>
            </section>

            <section className="sv-client-grid grid grid-cols-1 gap-4 xl:grid-cols-2">
              <article className="sv-card sv-client-link-card rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-4">
                <div className="sv-client-card-head">
                  <h2 className="sv-client-card-title mb-3 text-sm font-semibold text-on-surface">Linked Leads</h2>
                  <span className="sv-client-count-chip">{leads.length}</span>
                </div>
                <div className="sv-client-link-list space-y-2">
                  {leads.map((lead) => (
                    <article key={lead._id} className="sv-client-link-item">
                      <p className="sv-client-link-title">{lead.title}</p>
                      <span className={`sv-client-link-status ${toneClass(lead.statusId || lead.stage || lead.status || 'new')}`}>
                        {statusLabel(lead.statusId || lead.stage || lead.status, 'New')}
                      </span>
                    </article>
                  ))}
                  {!leads.length ? <p className="sv-client-empty text-sm text-on-surface-variant">No linked leads.</p> : null}
                </div>
              </article>
              <article className="sv-card sv-client-link-card rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-4">
                <div className="sv-client-card-head">
                  <h2 className="sv-client-card-title mb-3 text-sm font-semibold text-on-surface">Linked Projects</h2>
                  <span className="sv-client-count-chip">{projects.length}</span>
                </div>
                <div className="sv-client-link-list space-y-2">
                  {projects.map((project) => (
                    <article key={project._id} className="sv-client-link-item">
                      <p className="sv-client-link-title">{project.name}</p>
                      <span className={`sv-client-link-status ${toneClass(project.status || 'active')}`}>
                        {statusLabel(project.status, 'Active')}
                      </span>
                    </article>
                  ))}
                  {!projects.length ? <p className="sv-client-empty text-sm text-on-surface-variant">No linked projects.</p> : null}
                </div>
              </article>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}

export default ClientDetailPage;


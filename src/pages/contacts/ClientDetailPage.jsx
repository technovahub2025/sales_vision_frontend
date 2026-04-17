import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { clientsApi } from '../../api';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useSocket } from '../../contexts/SocketContext';
import { EVENTS } from '../../socket/events';
import { toRealtimeEvent } from '../../socket/realtime';

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
    <main className="min-h-screen">
      <div className="space-y-6">
        {loading ? <p className="text-sm text-on-surface-variant">Loading client...</p> : null}
        {error ? <p className="text-sm text-error">{error}</p> : null}
        {client ? (
          <>
            <section className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-6">
              <div className="flex items-center gap-4">
                <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
                  {String(client.name || 'CL').slice(0, 2).toUpperCase()}
                </span>
                <div>
                  <h1 className="text-2xl font-semibold text-gray-900">{client.name}</h1>
                  <p className="text-sm text-on-surface-variant">{client.industry || 'Industry not set'}</p>
                </div>
              </div>
            </section>

            <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <article className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-4">
                <h2 className="mb-3 text-sm font-semibold text-on-surface">Linked Leads</h2>
                <div className="space-y-2">
                  {leads.map((lead) => (
                    <p key={lead._id} className="text-sm text-on-surface-variant">
                      {lead.title} - {lead.status || 'new'}
                    </p>
                  ))}
                  {!leads.length ? <p className="text-sm text-on-surface-variant">No linked leads.</p> : null}
                </div>
              </article>
              <article className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-4">
                <h2 className="mb-3 text-sm font-semibold text-on-surface">Linked Projects</h2>
                <div className="space-y-2">
                  {projects.map((project) => (
                    <p key={project._id} className="text-sm text-on-surface-variant">
                      {project.name} - {project.status || 'active'}
                    </p>
                  ))}
                  {!projects.length ? <p className="text-sm text-on-surface-variant">No linked projects.</p> : null}
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


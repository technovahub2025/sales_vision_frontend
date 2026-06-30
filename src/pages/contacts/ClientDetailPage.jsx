import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { clientsApi } from '../../api';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useSocket } from '../../contexts/SocketContext';
import { EVENTS } from '../../socket/events';
import { toRealtimeEvent } from '../../socket/realtime';
import Icon from '../../components/ui/Icon';
import { ROUTES } from '../../routes/routePaths';

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

const fmtInr = (value) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value || 0));

const firstValue = (...values) => values.find((value) => String(value || '').trim()) || '';

function ClientDetailPage() {
  const { clientId } = useParams();
  const navigate = useNavigate();
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

  const profile = useMemo(() => {
    const custom = client?.customFields && typeof client.customFields === 'object' ? client.customFields : {};
    return {
      name: firstValue(client?.name, client?.contactName, custom.contactName, 'Client'),
      company: firstValue(client?.company, custom.companyName, 'Company not set'),
      industry: firstValue(client?.industry, custom.industry, 'Industry not set'),
      email: firstValue(client?.email, custom.email),
      phone: firstValue(client?.phone, custom.phone),
      website: firstValue(client?.website, custom.website),
      city: firstValue(client?.city, custom.city),
      state: firstValue(client?.state, custom.state),
      country: firstValue(client?.country, custom.country),
      address: firstValue(client?.address, custom.address),
      taxId: firstValue(client?.taxId, custom.taxId),
    };
  }, [client]);

  const leadValue = useMemo(
    () => leads.reduce((total, lead) => total + Number(lead?.value || 0), 0),
    [leads],
  );
  const wonLeads = useMemo(
    () => leads.filter((lead) => String(lead?.statusId || lead?.stage || lead?.status || '').toLowerCase() === 'won').length,
    [leads],
  );
  const activeProjects = useMemo(
    () => projects.filter((project) => !['archived', 'closed'].includes(String(project?.status || '').toLowerCase())).length,
    [projects],
  );
  const details = [
    { label: 'Company', value: profile.company, icon: 'business' },
    { label: 'Email', value: profile.email || '-', icon: 'mail' },
    { label: 'Phone', value: profile.phone || '-', icon: 'call' },
    { label: 'Website', value: profile.website || '-', icon: 'language' },
    { label: 'Location', value: [profile.city, profile.state, profile.country].filter(Boolean).join(', ') || '-', icon: 'location_on' },
    { label: 'Tax ID', value: profile.taxId || '-', icon: 'receipt_long' },
  ];

  return (
    <main className="sv-client-page min-h-screen">
      <div className="sv-client-stack">
        {loading ? <p className="sv-client-state text-sm text-on-surface-variant">Loading client...</p> : null}
        {error ? <p className="sv-client-state is-error text-sm text-error">{error}</p> : null}
        {client ? (
          <>
            <section className="sv-card sv-client-header rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-6">
              <div className="sv-client-head-wrap">
                <div className="sv-client-identity">
                  <span className="sv-client-avatar inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
                    {String(profile.name || 'CL').slice(0, 2).toUpperCase()}
                  </span>
                  <div className="sv-client-head-copy">
                    <span className="sv-client-eyebrow"><Icon name="handshake" className="text-base" /> Client profile</span>
                    <h1 className="sv-client-title text-2xl font-semibold text-gray-900">{profile.name}</h1>
                    <p className="sv-client-subtitle text-sm text-on-surface-variant">{profile.company} · {profile.industry}</p>
                  </div>
                </div>
                <button type="button" className="btn btn-light sv-ctl-btn sv-client-back-btn" onClick={() => navigate(ROUTES.leads)}>
                  <Icon name="arrow_back" className="text-base" />
                  Back to Leads
                </button>
              </div>
              <div className="sv-client-meta-row">
                <div className="sv-client-meta mt-2">
                  <span className="sv-client-meta-pill">{leads.length} linked leads</span>
                  <span className="sv-client-meta-pill">{projects.length} linked projects</span>
                  {profile.email ? <span className="sv-client-meta-pill">{profile.email}</span> : null}
                  {profile.phone ? <span className="sv-client-meta-pill">{profile.phone}</span> : null}
                </div>
              </div>
            </section>

            <section className="sv-client-kpis" aria-label="Client relationship metrics">
              <article className="sv-client-kpi is-blue">
                <span>Total Relationship</span>
                <strong>{fmtInr(leadValue)}</strong>
                <small>From linked leads</small>
              </article>
              <article className="sv-client-kpi is-green">
                <span>Won Leads</span>
                <strong>{wonLeads}</strong>
                <small>{leads.length} linked total</small>
              </article>
              <article className="sv-client-kpi is-amber">
                <span>Active Projects</span>
                <strong>{activeProjects}</strong>
                <small>{projects.length} linked total</small>
              </article>
              <article className="sv-client-kpi is-red">
                <span>Contact Health</span>
                <strong>{profile.email && profile.phone ? 'Ready' : 'Partial'}</strong>
                <small>Email and phone coverage</small>
              </article>
            </section>

            <section className="sv-client-profile-grid">
              <article className="sv-card sv-client-link-card sv-client-profile-card rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-4">
                <div className="sv-client-card-head">
                  <h2 className="sv-client-card-title mb-3 text-sm font-semibold text-on-surface">Profile Snapshot</h2>
                </div>
                <div className="sv-client-detail-grid">
                  {details.map((item) => (
                    <div key={item.label} className="sv-client-detail-item">
                      <Icon name={item.icon} className="text-base" />
                      <div>
                        <span>{item.label}</span>
                        <strong>{item.value}</strong>
                      </div>
                    </div>
                  ))}
                </div>
                {profile.address ? (
                  <div className="sv-client-address">
                    <span>Address</span>
                    <strong>{profile.address}</strong>
                  </div>
                ) : null}
              </article>

              <article className="sv-card sv-client-link-card sv-client-notes-card rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-4">
                <div className="sv-client-card-head">
                  <h2 className="sv-client-card-title mb-3 text-sm font-semibold text-on-surface">Relationship Summary</h2>
                </div>
                <div className="sv-client-summary-list">
                  <p><strong>{profile.name}</strong> is connected to <strong>{leads.length}</strong> lead{leads.length === 1 ? '' : 's'} and <strong>{projects.length}</strong> project{projects.length === 1 ? '' : 's'}.</p>
                  <p>The visible opportunity value is <strong>{fmtInr(leadValue)}</strong>, with <strong>{wonLeads}</strong> won lead{wonLeads === 1 ? '' : 's'}.</p>
                  <p>{profile.email || profile.phone ? 'Primary contact details are available for follow-up.' : 'Add email or phone details to make follow-up faster.'}</p>
                </div>
              </article>
            </section>

            <section className="sv-client-grid grid grid-cols-1 gap-4 xl:grid-cols-2">
              <article className="sv-card sv-client-link-card rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-4">
                <div className="sv-client-card-head">
                  <h2 className="sv-client-card-title mb-3 text-sm font-semibold text-on-surface">Linked Leads</h2>
                  <span className="sv-client-count-chip">{leads.length}</span>
                </div>
                <div className="sv-client-link-list space-y-2">
                  {leads.map((lead) => (
                    <article
                      key={lead._id}
                      className="sv-client-link-item is-clickable"
                      role="button"
                      tabIndex={0}
                      onClick={() => navigate(ROUTES.leads)}
                      onKeyDown={(event) => { if (event.key === 'Enter') navigate(ROUTES.leads); }}
                    >
                      <div>
                        <p className="sv-client-link-title">{lead.title}</p>
                        <small>{lead.value ? fmtInr(lead.value) : 'No value set'}</small>
                      </div>
                      <div className="sv-client-link-tail">
                        <span className={`sv-client-link-status ${toneClass(lead.statusId || lead.stage || lead.status || 'new')}`}>
                          {statusLabel(lead.statusId || lead.stage || lead.status, 'New')}
                        </span>
                        <Icon name="arrow_forward" className="text-sm" />
                      </div>
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
                    <article
                      key={project._id}
                      className="sv-client-link-item is-clickable"
                      role="button"
                      tabIndex={0}
                      onClick={() => navigate(ROUTES.projectOverview.replace(':projectId', project._id))}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') navigate(ROUTES.projectOverview.replace(':projectId', project._id));
                      }}
                    >
                      <div>
                        <p className="sv-client-link-title">{project.name}</p>
                        <small>{project.description || 'Open project overview'}</small>
                      </div>
                      <div className="sv-client-link-tail">
                        <span className={`sv-client-link-status ${toneClass(project.status || 'active')}`}>
                          {statusLabel(project.status, 'Active')}
                        </span>
                        <Icon name="arrow_forward" className="text-sm" />
                      </div>
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


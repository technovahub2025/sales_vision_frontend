import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Icon from '../../components/ui/Icon';
import { campaignsApi, usersApi } from '../../api';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useLeads } from '../../hooks/useLeads';
import { useClients } from '../../hooks/useClients';
import { useSocket } from '../../contexts/SocketContext';
import { EVENTS } from '../../socket/events';
import { toRealtimeEvent } from '../../socket/realtime';
import { ROUTES } from '../../routes/routePaths';

const STATUS_FLOW = {
  draft: ['active'],
  active: ['paused', 'completed'],
  paused: ['active', 'completed'],
  completed: [],
};

function formatINR(value) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(
    Number(value || 0),
  );
}

function toDateInput(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function EditCampaignModal({ open, form, onChange, onToggleLead, onToggleClient, onClose, onSubmit, busy, users, leads, clients, error }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-surface-container-lowest p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-on-surface">Edit Campaign</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container">
            <Icon name="close" className="text-lg" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <input required value={form.name} onChange={(e) => onChange('name', e.target.value)} placeholder="Campaign name *" className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm" />
          <input value={form.subtitle} onChange={(e) => onChange('subtitle', e.target.value)} placeholder="Subtitle" className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm" />
          <input required value={form.channel} onChange={(e) => onChange('channel', e.target.value)} placeholder="Channel *" className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm" />

          <select
            required
            value={form.ownerId}
            onChange={(e) => {
              const selectedId = e.target.value;
              const selected = users.find((user) => String(user._id) === String(selectedId));
              onChange('ownerId', selectedId);
              onChange('owner', selected?.displayName || selected?.name || selected?.email || '');
              onChange('lead', selected?.displayName || selected?.name || selected?.email || '');
            }}
            className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm"
          >
            <option value="">Select owner/lead *</option>
            {users.map((user) => (
              <option key={user._id} value={user._id}>{user.displayName || user.name || user.email || 'Unknown'}</option>
            ))}
          </select>

          <select value={form.status} onChange={(e) => onChange('status', e.target.value)} className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm">
            {Object.keys(STATUS_FLOW).map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>

          <input type="date" required value={form.startDate} onChange={(e) => onChange('startDate', e.target.value)} className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm" />
          <input type="date" value={form.endDate} onChange={(e) => onChange('endDate', e.target.value)} className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm" />

          <input type="number" min="0" value={form.budget} onChange={(e) => onChange('budget', e.target.value)} placeholder="Budget" className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm" />
          <input type="number" min="0" value={form.spend} onChange={(e) => onChange('spend', e.target.value)} placeholder="Spend" className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm" />
          <input type="number" min="0" value={form.conversionRate} onChange={(e) => onChange('conversionRate', e.target.value)} placeholder="Conversion Rate (%)" className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm" />
          <input type="number" step="0.01" value={form.roi} onChange={(e) => onChange('roi', e.target.value)} placeholder="ROI (x)" className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm" />
          <input value={form.targetAudience} onChange={(e) => onChange('targetAudience', e.target.value)} placeholder="Target audience" className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm" />
          <input value={form.goalType} onChange={(e) => onChange('goalType', e.target.value)} placeholder="Goal type" className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm" />
          <input type="number" min="0" value={form.goalValue} onChange={(e) => onChange('goalValue', e.target.value)} placeholder="Goal value" className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm" />
          <input value={form.utmSource} onChange={(e) => onChange('utmSource', e.target.value)} placeholder="UTM Source" className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm" />
          <input value={form.utmMedium} onChange={(e) => onChange('utmMedium', e.target.value)} placeholder="UTM Medium" className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm" />
          <input value={form.utmCampaign} onChange={(e) => onChange('utmCampaign', e.target.value)} placeholder="UTM Campaign" className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm md:col-span-2" />
          <textarea value={form.notes} onChange={(e) => onChange('notes', e.target.value)} placeholder="Notes" rows={3} className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm md:col-span-2" />

          <div className="rounded-lg border border-outline-variant/40 p-3 md:col-span-2">
            <p className="mb-2 text-xs font-semibold uppercase text-on-surface-variant">Linked Leads</p>
            <div className="grid max-h-28 grid-cols-1 gap-2 overflow-y-auto md:grid-cols-2">
              {leads.map((lead) => (
                <label key={lead._id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.leadIds.includes(String(lead._id))} onChange={() => onToggleLead(String(lead._id))} />
                  <span>{lead.title || 'Untitled lead'}</span>
                </label>
              ))}
              {!leads.length ? <p className="text-xs text-on-surface-variant">No leads available.</p> : null}
            </div>
          </div>

          <div className="rounded-lg border border-outline-variant/40 p-3 md:col-span-2">
            <p className="mb-2 text-xs font-semibold uppercase text-on-surface-variant">Linked Clients</p>
            <div className="grid max-h-28 grid-cols-1 gap-2 overflow-y-auto md:grid-cols-2">
              {clients.map((client) => (
                <label key={client._id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={form.clientIds.includes(String(client._id))} onChange={() => onToggleClient(String(client._id))} />
                  <span>{client.name || 'Unnamed client'}</span>
                </label>
              ))}
              {!clients.length ? <p className="text-xs text-on-surface-variant">No clients available.</p> : null}
            </div>
          </div>

          {error ? <p className="text-sm text-error md:col-span-2">{error}</p> : null}

          <div className="flex justify-end gap-2 md:col-span-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-outline-variant px-4 py-2 text-sm font-semibold">Cancel</button>
            <button type="submit" disabled={busy} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
              {busy ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CampaignDetailPage() {
  const navigate = useNavigate();
  const { campaignId } = useParams();
  const { workspaceId } = useWorkspace();
  const { items: leadItems } = useLeads();
  const { clients, list: listClients } = useClients();
  const { socket, joinWorkspace, leaveWorkspace, onReconnect } = useSocket();

  const [campaign, setCampaign] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [users, setUsers] = useState([]);
  const [busyAction, setBusyAction] = useState(false);
  const [toast, setToast] = useState(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editError, setEditError] = useState('');
  const [editForm, setEditForm] = useState({});

  const hydrate = useCallback(
    async ({ silent = false } = {}) => {
      if (!workspaceId || !campaignId) return;
      if (!silent) setLoading(true);
      setError('');
      try {
        const response = await campaignsApi.get(workspaceId, campaignId);
        setCampaign(response.data || null);
      } catch (nextError) {
        if (!silent) setError(nextError.message || 'Failed to load campaign');
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [workspaceId, campaignId],
  );

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!workspaceId) return;
    usersApi
      .list(workspaceId, { page: 1, limit: 100 })
      .then((response) => setUsers(response.data || []))
      .catch(() => setUsers([]));
    listClients({ page: 1, limit: 200 });
  }, [workspaceId, listClients]);

  useEffect(() => {
    if (!socket || !workspaceId || !campaignId) return undefined;
    const joinPayload = { workspaceId, modules: ['campaigns', 'activity'] };
    joinWorkspace(joinPayload);

    const refreshSilent = () => hydrate({ silent: true });
    const onRealtime = (raw) => {
      const evt = toRealtimeEvent(raw);
      if (String(evt.workspaceId || '') !== String(workspaceId)) return;
      if (evt.entity !== 'campaign') return;
      const evtId = String(evt.entityId || evt.payload?._id || evt.payload?.id || '');
      if (evtId && evtId !== String(campaignId)) return;
      refreshSilent();
    };

    socket.on(EVENTS.REALTIME_EVENT, onRealtime);
    socket.on('campaign:updated', refreshSilent);
    socket.on('campaign:status_changed', refreshSilent);
    const unsubscribeReconnect = onReconnect(refreshSilent);

    return () => {
      leaveWorkspace(joinPayload);
      socket.off(EVENTS.REALTIME_EVENT, onRealtime);
      socket.off('campaign:updated', refreshSilent);
      socket.off('campaign:status_changed', refreshSilent);
      unsubscribeReconnect();
    };
  }, [socket, workspaceId, campaignId, joinWorkspace, leaveWorkspace, hydrate, onReconnect]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  const linkedLeads = campaign?.linkedLeads || [];
  const linkedClients = campaign?.linkedClients || [];

  const startEdit = () => {
    if (!campaign) return;
    setEditError('');
    setEditForm({
      name: campaign.name || '',
      subtitle: campaign.subtitle || '',
      channel: campaign.channel || '',
      ownerId: campaign.ownerId || '',
      owner: campaign.owner || '',
      lead: campaign.lead || '',
      status: campaign.status || 'draft',
      startDate: toDateInput(campaign.startDate),
      endDate: toDateInput(campaign.endDate),
      budget: String(campaign.budget ?? ''),
      spend: String(campaign.spend ?? ''),
      conversionRate: String(campaign.conversionRate ?? ''),
      roi: String(campaign.roi ?? ''),
      targetAudience: campaign.targetAudience || '',
      goalType: campaign.goalType || '',
      goalValue: String(campaign.goalValue ?? ''),
      utmSource: campaign.utmSource || '',
      utmMedium: campaign.utmMedium || '',
      utmCampaign: campaign.utmCampaign || '',
      notes: campaign.notes || '',
      leadIds: Array.isArray(campaign.leadIds) ? campaign.leadIds.map((item) => String(item)) : [],
      clientIds: Array.isArray(campaign.clientIds) ? campaign.clientIds.map((item) => String(item)) : [],
    });
    setEditOpen(true);
  };

  const toggleLead = (leadId) => {
    setEditForm((current) => ({
      ...current,
      leadIds: current.leadIds.includes(leadId)
        ? current.leadIds.filter((item) => item !== leadId)
        : [...current.leadIds, leadId],
    }));
  };

  const toggleClient = (clientId) => {
    setEditForm((current) => ({
      ...current,
      clientIds: current.clientIds.includes(clientId)
        ? current.clientIds.filter((item) => item !== clientId)
        : [...current.clientIds, clientId],
    }));
  };

  const handleSaveEdit = async (event) => {
    event.preventDefault();
    if (!workspaceId || !campaignId) return;

    if (!editForm.name?.trim() || !editForm.channel?.trim() || !editForm.ownerId || !editForm.startDate) {
      setEditError('Please fill all required fields');
      return;
    }
    if (editForm.endDate && editForm.startDate > editForm.endDate) {
      setEditError('Start date cannot be after end date');
      return;
    }

    const payload = {
      name: editForm.name.trim(),
      subtitle: editForm.subtitle.trim(),
      channel: editForm.channel.trim(),
      ownerId: editForm.ownerId,
      owner: editForm.owner.trim(),
      lead: editForm.lead.trim(),
      status: editForm.status,
      startDate: editForm.startDate,
      endDate: editForm.endDate || null,
      budget: Number(editForm.budget || 0),
      spend: Number(editForm.spend || 0),
      conversionRate: Number(editForm.conversionRate || 0),
      roi: Number(editForm.roi || 0),
      targetAudience: editForm.targetAudience.trim(),
      goalType: editForm.goalType.trim(),
      goalValue: Number(editForm.goalValue || 0),
      utmSource: editForm.utmSource.trim(),
      utmMedium: editForm.utmMedium.trim(),
      utmCampaign: editForm.utmCampaign.trim(),
      notes: editForm.notes.trim(),
      leadIds: editForm.leadIds,
      clientIds: editForm.clientIds,
    };

    setBusyAction(true);
    setEditError('');
    try {
      await campaignsApi.update(workspaceId, campaignId, payload);
      setEditOpen(false);
      await hydrate({ silent: true });
      setToast({ tone: 'success', message: 'Campaign updated' });
    } catch (nextError) {
      setEditError(nextError.message || 'Failed to save campaign');
    } finally {
      setBusyAction(false);
    }
  };

  const handleStatusChange = async (status) => {
    if (!workspaceId || !campaignId) return;
    setBusyAction(true);
    try {
      await campaignsApi.updateStatus(workspaceId, campaignId, status);
      await hydrate({ silent: true });
      setToast({ tone: 'success', message: `Campaign moved to ${status}` });
    } catch (nextError) {
      setToast({ tone: 'error', message: nextError.message || 'Failed to update status' });
    } finally {
      setBusyAction(false);
    }
  };

  const handleExport = async () => {
    if (!workspaceId || !campaignId) return;
    try {
      const report = await campaignsApi.exportReport(workspaceId, campaignId);
      downloadJson(`campaign-${campaignId}-report.json`, report.data || report);
      setToast({ tone: 'success', message: 'Campaign report exported' });
    } catch (nextError) {
      setToast({ tone: 'error', message: nextError.message || 'Export failed' });
    }
  };

  const handleDelete = async () => {
    if (!workspaceId || !campaignId) return;
    if (!window.confirm('Archive this campaign?')) return;
    setBusyAction(true);
    try {
      await campaignsApi.remove(workspaceId, campaignId);
      setToast({ tone: 'success', message: 'Campaign archived' });
      navigate(ROUTES.campaigns);
    } catch (nextError) {
      setToast({ tone: 'error', message: nextError.message || 'Failed to archive campaign' });
    } finally {
      setBusyAction(false);
    }
  };

  const nextActions = campaign ? STATUS_FLOW[String(campaign.status || 'draft').toLowerCase()] || [] : [];

  return (
    <main className="min-h-screen bg-surface">
      <div className="mx-auto max-w-[1400px] space-y-6 p-8">
        <section className="flex flex-wrap items-start justify-between gap-4 rounded-xl bg-surface-container-lowest p-6">
          <div>
            <h1 className="text-2xl font-bold text-on-surface">{campaign?.name || 'Campaign'}</h1>
            <p className="mt-1 text-sm text-on-surface-variant">{campaign?.channel || '-'} • {campaign?.status || 'draft'}</p>
            <p className="text-xs text-on-surface-variant">{campaign?.owner || campaign?.lead || 'Unassigned owner'}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {nextActions.includes('active') ? <button disabled={busyAction} onClick={() => handleStatusChange('active')} className="rounded-lg border border-outline-variant px-3 py-2 text-sm font-semibold">Activate</button> : null}
            {nextActions.includes('paused') ? <button disabled={busyAction} onClick={() => handleStatusChange('paused')} className="rounded-lg border border-outline-variant px-3 py-2 text-sm font-semibold">Pause</button> : null}
            {nextActions.includes('completed') ? <button disabled={busyAction} onClick={() => handleStatusChange('completed')} className="rounded-lg border border-outline-variant px-3 py-2 text-sm font-semibold">Complete</button> : null}
            <button disabled={busyAction} onClick={startEdit} className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white">Edit</button>
            <button disabled={busyAction} onClick={handleExport} className="rounded-lg border border-outline-variant px-3 py-2 text-sm font-semibold">Export</button>
            <button disabled={busyAction} onClick={handleDelete} className="rounded-lg border border-error/30 px-3 py-2 text-sm font-semibold text-error">Delete</button>
          </div>
        </section>

        {loading ? <p className="text-sm text-on-surface-variant">Loading campaign...</p> : null}
        {error ? <p className="text-sm text-error">{error}</p> : null}

        {campaign ? (
          <>
            <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <article className="rounded-xl bg-surface-container-lowest p-4">
                <p className="text-xs uppercase text-on-surface-variant">Spend</p>
                <p className="text-2xl font-bold text-on-surface">{formatINR(campaign.spend || 0)}</p>
              </article>
              <article className="rounded-xl bg-surface-container-lowest p-4">
                <p className="text-xs uppercase text-on-surface-variant">ROI</p>
                <p className="text-2xl font-bold text-on-surface">{Number(campaign.roi || 0).toFixed(2)}x</p>
              </article>
              <article className="rounded-xl bg-surface-container-lowest p-4">
                <p className="text-xs uppercase text-on-surface-variant">Conversion</p>
                <p className="text-2xl font-bold text-on-surface">{Number(campaign.conversionRate || 0).toFixed(1)}%</p>
              </article>
              <article className="rounded-xl bg-surface-container-lowest p-4">
                <p className="text-xs uppercase text-on-surface-variant">Linked</p>
                <p className="text-2xl font-bold text-on-surface">{campaign.linkedLeadsCount || 0} Leads / {campaign.linkedClientsCount || 0} Clients</p>
              </article>
            </section>

            <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <article className="rounded-xl bg-surface-container-lowest p-4 xl:col-span-2">
                <h2 className="mb-3 text-lg font-semibold text-on-surface">Associated Leads</h2>
                <div className="space-y-2">
                  {linkedLeads.map((lead) => (
                    <div key={lead._id} className="flex items-center justify-between rounded-lg border border-outline-variant/20 px-3 py-2">
                      <div>
                        <p className="text-sm font-semibold text-on-surface">{lead.title || 'Untitled lead'}</p>
                        <p className="text-xs text-on-surface-variant">{lead.source || '-'} • {lead.statusId || '-'}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigate(ROUTES.leads)}
                        className="rounded bg-surface-container px-2 py-1 text-xs font-semibold"
                      >
                        Open Leads
                      </button>
                    </div>
                  ))}
                  {!linkedLeads.length ? <p className="text-sm text-on-surface-variant">No associated leads.</p> : null}
                </div>
              </article>

              <article className="rounded-xl bg-surface-container-lowest p-4">
                <h2 className="mb-3 text-lg font-semibold text-on-surface">Converted/Linked Clients</h2>
                <div className="space-y-2">
                  {linkedClients.map((client) => (
                    <div key={client._id} className="rounded-lg border border-outline-variant/20 px-3 py-2">
                      <p className="text-sm font-semibold text-on-surface">{client.name || 'Unnamed client'}</p>
                      <p className="text-xs text-on-surface-variant">{client.company || '-'} • {client.email || '-'}</p>
                      <button
                        type="button"
                        onClick={() => navigate(ROUTES.clientDetail.replace(':clientId', client._id))}
                        className="mt-2 rounded bg-surface-container px-2 py-1 text-xs font-semibold"
                      >
                        Open Client
                      </button>
                    </div>
                  ))}
                  {!linkedClients.length ? <p className="text-sm text-on-surface-variant">No linked clients.</p> : null}
                </div>
              </article>
            </section>

            <section className="rounded-xl bg-surface-container-lowest p-4">
              <h2 className="mb-3 text-lg font-semibold text-on-surface">Activity Timeline</h2>
              <div className="space-y-2">
                {(campaign.timeline || []).map((item, index) => (
                  <div key={item._id || index} className="rounded-lg border border-outline-variant/20 px-3 py-2">
                    <p className="text-sm font-semibold text-on-surface">{item.action || 'updated'}</p>
                    <p className="text-xs text-on-surface-variant">{item.message || JSON.stringify(item.payload || {})}</p>
                    <p className="text-[11px] text-on-surface-variant">{item.occurredAt ? new Date(item.occurredAt).toLocaleString() : '-'}</p>
                  </div>
                ))}
                {!campaign.timeline?.length ? <p className="text-sm text-on-surface-variant">No campaign activity yet.</p> : null}
              </div>
            </section>
          </>
        ) : null}
      </div>

      <EditCampaignModal
        open={editOpen}
        form={editForm}
        onChange={(field, value) => setEditForm((current) => ({ ...current, [field]: value }))}
        onToggleLead={toggleLead}
        onToggleClient={toggleClient}
        onClose={() => setEditOpen(false)}
        onSubmit={handleSaveEdit}
        busy={busyAction}
        users={users}
        leads={leadItems || []}
        clients={clients || []}
        error={editError}
      />

      {toast ? (
        <div className={`fixed bottom-5 right-5 z-[60] rounded-lg px-4 py-2 text-sm font-semibold text-white ${toast.tone === 'error' ? 'bg-error' : 'bg-green-600'}`}>
          {toast.message}
        </div>
      ) : null}
    </main>
  );
}

export default CampaignDetailPage;


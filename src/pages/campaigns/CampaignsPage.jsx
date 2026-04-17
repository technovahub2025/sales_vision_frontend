import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/ui/Icon';
import { useCampaigns } from '../../hooks/useCampaigns';
import { useLeads } from '../../hooks/useLeads';
import { useClients } from '../../hooks/useClients';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { campaignsApi, usersApi } from '../../api';
import { ROUTES } from '../../routes/routePaths';

const STATUS_OPTIONS = ['draft', 'active', 'paused', 'completed'];

const EMPTY_FORM = {
  name: '',
  subtitle: '',
  channel: '',
  ownerId: '',
  owner: '',
  lead: '',
  status: 'draft',
  startDate: '',
  endDate: '',
  budget: '',
  spend: '',
  conversionRate: '',
  roi: '',
  targetAudience: '',
  goalType: '',
  goalValue: '',
  utmSource: '',
  utmMedium: '',
  utmCampaign: '',
  notes: '',
  leadIds: [],
  clientIds: [],
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

function CreateCampaignModal({ open, form, onChange, onToggleLead, onToggleClient, onClose, onSubmit, busy, users, leads, clients, error }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-surface-container-lowest p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-on-surface">Create Campaign</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container">
            <Icon name="close" className="text-lg" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <input required value={form.name} onChange={(e) => onChange('name', e.target.value)} placeholder="Campaign name *" className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm" />
          <input value={form.subtitle} onChange={(e) => onChange('subtitle', e.target.value)} placeholder="Subtitle" className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm" />

          <input required value={form.channel} onChange={(e) => onChange('channel', e.target.value)} placeholder="Channel * (meta, google, whatsapp...)" className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm" />

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
              <option key={user._id} value={user._id}>
                {user.displayName || user.name || user.email || 'Unknown'}
              </option>
            ))}
          </select>

          <select value={form.status} onChange={(e) => onChange('status', e.target.value)} className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm">
            {STATUS_OPTIONS.map((status) => (
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
            <p className="mb-2 text-xs font-semibold uppercase text-on-surface-variant">Link Leads</p>
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
            <p className="mb-2 text-xs font-semibold uppercase text-on-surface-variant">Link Clients</p>
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
              {busy ? 'Creating...' : 'Create Campaign'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CampaignsPage() {
  const navigate = useNavigate();
  const { workspaceId } = useWorkspace();
  const { items: campaignItems, loading, error, createItem, refresh } = useCampaigns();
  const { items: leadItems } = useLeads();
  const { clients, list: listClients } = useClients();

  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [archiveScope, setArchiveScope] = useState('all');
  const [sortBy, setSortBy] = useState('recent');
  const [createOpen, setCreateOpen] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createForm, setCreateForm] = useState(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!workspaceId) return;
    usersApi
      .list(workspaceId, { page: 1, limit: 100 })
      .then((response) => setUsers(response.data || []))
      .catch(() => setUsers([]));
    listClients({ page: 1, limit: 200 });
  }, [workspaceId, listClients]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(timer);
  }, [toast]);

  const campaigns = useMemo(() => {
    const query = String(search || '').trim().toLowerCase();
    const rows = (campaignItems || []).filter((item) => {
      if (archiveScope === 'all' && item?.isArchived) return false;
      if (archiveScope === 'archived' && !item?.isArchived) return false;
      if (statusFilter !== 'all' && String(item.status || '').toLowerCase() !== statusFilter) return false;
      if (!query) return true;
      const haystack = [item.name, item.channel, item.owner, item.lead]
        .map((piece) => String(piece || '').toLowerCase())
        .join(' ');
      return haystack.includes(query);
    });

    return [...rows].sort((a, b) => {
      if (sortBy === 'start_date') {
        return new Date(b.startDate || 0).getTime() - new Date(a.startDate || 0).getTime();
      }
      if (sortBy === 'spend') {
        return Number(b.spend || 0) - Number(a.spend || 0);
      }
      if (sortBy === 'conversion') {
        return Number(b.conversionRate || 0) - Number(a.conversionRate || 0);
      }
      return new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime();
    });
  }, [campaignItems, search, statusFilter, sortBy, archiveScope]);

  const metrics = useMemo(() => {
    const total = campaigns.length;
    const active = campaigns.filter((item) => String(item.status || '').toLowerCase() === 'active').length;
    const spend = campaigns.reduce((sum, item) => sum + Number(item.spend || 0), 0);
    const avgRoi = total ? campaigns.reduce((sum, item) => sum + Number(item.roi || 0), 0) / total : 0;
    const avgConversion = total
      ? campaigns.reduce((sum, item) => sum + Number(item.conversionRate || 0), 0) / total
      : 0;

    return {
      total,
      active,
      spend,
      avgRoi: Number(avgRoi.toFixed(2)),
      avgConversion: Number(avgConversion.toFixed(1)),
    };
  }, [campaigns]);

  const openCreate = () => {
    setCreateError('');
    setCreateForm(EMPTY_FORM);
    setCreateOpen(true);
  };

  const closeCreate = () => {
    if (createBusy) return;
    setCreateOpen(false);
    setCreateError('');
    setCreateForm(EMPTY_FORM);
  };

  const setField = (field, value) => {
    setCreateForm((current) => ({ ...current, [field]: value }));
  };

  const toggleLead = (leadId) => {
    setCreateForm((current) => ({
      ...current,
      leadIds: current.leadIds.includes(leadId)
        ? current.leadIds.filter((item) => item !== leadId)
        : [...current.leadIds, leadId],
    }));
  };

  const toggleClient = (clientId) => {
    setCreateForm((current) => ({
      ...current,
      clientIds: current.clientIds.includes(clientId)
        ? current.clientIds.filter((item) => item !== clientId)
        : [...current.clientIds, clientId],
    }));
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    setCreateError('');

    if (!createForm.name.trim() || !createForm.channel.trim() || !createForm.ownerId || !createForm.startDate) {
      setCreateError('Please fill all required fields');
      return;
    }

    if (createForm.endDate && createForm.startDate > createForm.endDate) {
      setCreateError('Start date cannot be after end date');
      return;
    }

    const payload = {
      name: createForm.name.trim(),
      subtitle: createForm.subtitle.trim(),
      channel: createForm.channel.trim(),
      ownerId: createForm.ownerId,
      owner: createForm.owner.trim(),
      lead: createForm.lead.trim(),
      status: createForm.status,
      startDate: createForm.startDate,
      endDate: createForm.endDate || null,
      budget: Number(createForm.budget || 0),
      spend: Number(createForm.spend || 0),
      conversionRate: Number(createForm.conversionRate || 0),
      roi: Number(createForm.roi || 0),
      targetAudience: createForm.targetAudience.trim(),
      goalType: createForm.goalType.trim(),
      goalValue: Number(createForm.goalValue || 0),
      utmSource: createForm.utmSource.trim(),
      utmMedium: createForm.utmMedium.trim(),
      utmCampaign: createForm.utmCampaign.trim(),
      notes: createForm.notes.trim(),
      leadIds: createForm.leadIds,
      clientIds: createForm.clientIds,
    };

    setCreateBusy(true);
    try {
      const created = await createItem(payload);
      closeCreate();
      setToast({ tone: 'success', message: 'Campaign created' });
      if (created?._id) {
        navigate(ROUTES.campaignDetail.replace(':campaignId', created._id));
      }
    } catch (nextError) {
      setCreateError(nextError.message || 'Failed to create campaign');
    } finally {
      setCreateBusy(false);
    }
  };

  const handleDuplicate = async (campaignId) => {
    if (!workspaceId) return;
    try {
      await campaignsApi.duplicate(workspaceId, campaignId);
      await refresh({ silent: true });
      setToast({ tone: 'success', message: 'Campaign duplicated' });
    } catch (nextError) {
      setToast({ tone: 'error', message: nextError.message || 'Failed to duplicate campaign' });
    }
  };

  const handleArchiveToggle = async () => {
    if (!deleteTarget) return;
    try {
      if (deleteTarget?.isArchived) {
        await campaignsApi.restore(workspaceId, deleteTarget._id);
        setToast({ tone: 'success', message: 'Campaign unarchived' });
      } else {
        await campaignsApi.remove(workspaceId, deleteTarget._id);
        setToast({ tone: 'success', message: 'Campaign archived' });
      }
      await refresh({ silent: true });
      setDeleteTarget(null);
    } catch (nextError) {
      setToast({ tone: 'error', message: nextError.message || 'Failed to update campaign archive status' });
    }
  };

  const handleExportAll = async () => {
    if (!workspaceId) return;
    try {
      const report = await campaignsApi.exportReport(workspaceId, null, undefined, { includeArchived: 'true' });
      downloadJson(`campaign-report-${new Date().toISOString().slice(0, 10)}.json`, report.data || report);
      setToast({ tone: 'success', message: 'Report exported' });
    } catch (nextError) {
      setToast({ tone: 'error', message: nextError.message || 'Failed to export report' });
    }
  };

  return (
    <main className="min-h-screen bg-surface">
      <div className="mx-auto max-w-[1400px] space-y-6 p-8">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-on-surface">Campaign Overview</h1>
            <p className="text-on-surface-variant">Lead generation campaigns with actionable detail workflows.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleExportAll} className="rounded-lg px-4 py-2 font-medium text-primary transition-colors hover:bg-surface-container-high">Export Report</button>
            <button onClick={openCreate} className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary to-primary-container px-5 py-2 font-semibold text-white shadow-sm transition-all hover:opacity-90">
              <Icon name="add_circle" className="text-lg" />
              New Campaign
            </button>
          </div>
        </header>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <article className="rounded-xl bg-surface-container-lowest p-5">
            <p className="text-sm text-on-surface-variant">Total Active Campaigns</p>
            <p className="text-3xl font-bold text-on-surface">{metrics.active}</p>
          </article>
          <article className="rounded-xl bg-surface-container-lowest p-5">
            <p className="text-sm text-on-surface-variant">Conversion Rate</p>
            <p className="text-3xl font-bold text-on-surface">{metrics.avgConversion}%</p>
          </article>
          <article className="rounded-xl bg-surface-container-lowest p-5">
            <p className="text-sm text-on-surface-variant">Average ROI</p>
            <p className="text-3xl font-bold text-on-surface">{metrics.avgRoi}x</p>
          </article>
          <article className="rounded-xl bg-surface-container-lowest p-5">
            <p className="text-sm text-on-surface-variant">Total Spend</p>
            <p className="text-3xl font-bold text-on-surface">{formatINR(metrics.spend)}</p>
          </article>
        </section>

        <section className="overflow-hidden rounded-xl bg-surface-container-lowest shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-outline-variant/20 p-4">
            <h2 className="text-lg font-bold text-on-surface">Active Initiatives</h2>
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search campaign/channel/owner"
                className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm"
              />
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm">
                <option value="all">All status</option>
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
              <select value={archiveScope} onChange={(e) => setArchiveScope(e.target.value)} className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm">
                <option value="all">All (Active)</option>
                <option value="archived">Archived only</option>
              </select>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm">
                <option value="recent">Recently updated</option>
                <option value="start_date">Start date</option>
                <option value="spend">Spend</option>
                <option value="conversion">Conversion</option>
              </select>
            </div>
          </div>

          {error ? <p className="px-4 py-4 text-sm text-error">{error}</p> : null}

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="bg-surface-container-low/50 text-xs uppercase tracking-wider text-on-surface-variant">
                  <th className="px-4 py-3">Campaign</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Owner</th>
                  <th className="px-4 py-3">Spend</th>
                  <th className="px-4 py-3">Conversion</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/10">
                {campaigns.map((campaign) => (
                  <tr key={campaign._id} className="transition-colors hover:bg-surface-container-low/30">
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-on-surface">{campaign.name || 'Untitled Campaign'}</p>
                        {campaign?.isArchived ? <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-700">Archived</span> : null}
                      </div>
                      <p className="text-xs text-on-surface-variant">{campaign.channel || campaign.subtitle || 'Campaign'}</p>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${String(campaign.status || 'draft').toLowerCase() === 'paused' ? 'bg-amber-100 text-amber-700' : String(campaign.status || 'draft').toLowerCase() === 'completed' ? 'bg-slate-200 text-slate-700' : String(campaign.status || 'draft').toLowerCase() === 'active' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}`}>
                        {campaign.status || 'draft'}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-on-surface-variant">{campaign.owner || campaign.lead || '-'}</td>
                    <td className="px-4 py-4 text-sm text-on-surface-variant">{formatINR(campaign.spend || 0)}</td>
                    <td className="px-4 py-4 text-sm text-on-surface-variant">{Number(campaign.conversionRate || 0).toFixed(1)}%</td>
                    <td className="px-4 py-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button onClick={() => navigate(ROUTES.campaignDetail.replace(':campaignId', campaign._id))} className="rounded bg-surface-container px-2 py-1 text-xs font-semibold">Open</button>
                        <button onClick={() => handleDuplicate(campaign._id)} className="rounded bg-surface-container px-2 py-1 text-xs font-semibold">Duplicate</button>
                        <button onClick={() => setDeleteTarget(campaign)} className={`rounded px-2 py-1 text-xs font-semibold ${campaign?.isArchived ? 'bg-green-100 text-green-700' : 'bg-surface-container text-error'}`}>
                          {campaign?.isArchived ? 'Unarchive' : 'Archive'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {!campaigns.length && !loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-8 text-center text-sm text-on-surface-variant">No campaigns available.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <CreateCampaignModal
        open={createOpen}
        form={createForm}
        onChange={setField}
        onToggleLead={toggleLead}
        onToggleClient={toggleClient}
        onClose={closeCreate}
        onSubmit={handleCreate}
        busy={createBusy}
        users={users}
        leads={leadItems || []}
        clients={clients || []}
        error={createError}
      />

      {deleteTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded-xl bg-surface-container-lowest p-5 shadow-2xl">
            <h3 className="text-lg font-semibold text-on-surface">{deleteTarget?.isArchived ? 'Unarchive Campaign?' : 'Archive Campaign?'}</h3>
            <p className="mt-2 text-sm text-on-surface-variant">
              {deleteTarget?.isArchived ? `${deleteTarget.name} will move back to active records.` : `${deleteTarget.name} will be removed from active records.`}
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setDeleteTarget(null)} className="rounded-lg border border-outline-variant px-4 py-2 text-sm font-semibold">Cancel</button>
              <button onClick={handleArchiveToggle} className={`rounded-lg px-4 py-2 text-sm font-semibold text-white ${deleteTarget?.isArchived ? 'bg-green-600' : 'bg-error'}`}>
                {deleteTarget?.isArchived ? 'Unarchive' : 'Archive'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className={`fixed bottom-5 right-5 z-[60] rounded-lg px-4 py-2 text-sm font-semibold text-white ${toast.tone === 'error' ? 'bg-error' : 'bg-green-600'}`}>
          {toast.message}
        </div>
      ) : null}
    </main>
  );
}

export default CampaignsPage;


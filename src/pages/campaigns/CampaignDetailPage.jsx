import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Icon from '../../components/ui/Icon';
import DatePicker from '../../components/ui/DatePicker';
import SelectDropdown from '../../components/ui/SelectDropdown';
import ExportMenu from '../../components/ui/ExportMenu';
import { campaignsApi, usersApi } from '../../api';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { useLeads } from '../../hooks/useLeads';
import { useClients } from '../../hooks/useClients';
import { useSocket } from '../../contexts/SocketContext';
import { EVENTS } from '../../socket/events';
import { toRealtimeEvent } from '../../socket/realtime';
import { ROUTES } from '../../routes/routePaths';
import { exportRows } from '../../lib/exportData';

const STATUS_FLOW = {
  draft: ['active'],
  active: ['paused', 'completed'],
  paused: ['active', 'completed'],
  completed: [],
};
const STATUS_OPTIONS = Object.keys(STATUS_FLOW).map((status) => ({ value: status, label: status }));

function formatINR(value) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(
    Number(value || 0),
  );
}

function formatCompactMetric(value, suffix = '') {
  const number = Number(value || 0);
  if (!Number.isFinite(number)) return `0${suffix}`;
  if (Math.abs(number) >= 1000) {
    return `${new Intl.NumberFormat('en-IN', {
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(number)}${suffix}`;
  }
  const decimals = Math.abs(number) >= 100 ? 0 : 1;
  return `${number.toFixed(decimals)}${suffix}`;
}

function toDateInput(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function EditCampaignModal({ open, form, onChange, onToggleLead, onToggleClient, onClose, onSubmit, busy, users, leads, clients, error }) {
  if (!open) return null;

  return (
    <div className="sv-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-3">
      <div className="sv-card sv-campaigndetail-edit-modal" role="dialog" aria-modal="true" aria-label="Edit Campaign">
        <div className="sv-campaigndetail-modal-head">
          <h2 className="sv-campaigndetail-modal-title">Edit Campaign</h2>
          <button type="button" onClick={onClose} className="sv-modal-close-btn" aria-label="Close">
            <Icon name="close" className="text-xl" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="sv-campaigndetail-edit-form">
          <div className="sv-campaigndetail-form-grid">
            <div>
              <label className="sv-campaigndetail-label">
                Campaign Name <span className="text-error">*</span>
              </label>
              <input
                required
                value={form.name}
                onChange={(e) => onChange('name', e.target.value)}
                placeholder="Campaign name"
                className="sv-ctl-input sv-campaigndetail-field"
              />
            </div>

            <div>
              <label className="sv-campaigndetail-label">Subtitle</label>
              <input
                value={form.subtitle}
                onChange={(e) => onChange('subtitle', e.target.value)}
                placeholder="Subtitle"
                className="sv-ctl-input sv-campaigndetail-field"
              />
            </div>

            <div>
              <label className="sv-campaigndetail-label">
                Channel <span className="text-error">*</span>
              </label>
              <input
                required
                value={form.channel}
                onChange={(e) => onChange('channel', e.target.value)}
                placeholder="Channel"
                className="sv-ctl-input sv-campaigndetail-field"
              />
            </div>

            <div>
              <label className="sv-campaigndetail-label">
                Owner/Lead <span className="text-error">*</span>
              </label>
              <SelectDropdown
                value={form.ownerId}
                onChange={(selectedId) => {
                  const selected = users.find((user) => String(user._id) === String(selectedId));
                  onChange('ownerId', selectedId);
                  onChange('owner', selected?.displayName || selected?.name || selected?.email || '');
                  onChange('lead', selected?.displayName || selected?.name || selected?.email || '');
                }}
                options={[
                  { value: '', label: 'Select owner/lead' },
                  ...users.map((user) => ({
                    value: user._id,
                    label: user.displayName || user.name || user.email || 'Unknown',
                  })),
                ]}
                triggerClassName="sv-campaigndetail-field"
              />
            </div>

            <div>
              <label className="sv-campaigndetail-label">Status</label>
              <SelectDropdown
                value={form.status}
                onChange={(nextValue) => onChange('status', nextValue)}
                options={STATUS_OPTIONS}
                triggerClassName="sv-campaigndetail-field"
              />
            </div>

            <div>
              <label className="sv-campaigndetail-label">
                Start Date <span className="text-error">*</span>
              </label>
              <DatePicker
                value={form.startDate}
                onChange={(nextValue) => onChange('startDate', nextValue)}
                className="sv-campaigndetail-field"
                triggerClassName="sv-ctl-input"
                placeholder="Start date"
              />
            </div>

            <div>
              <label className="sv-campaigndetail-label">End Date</label>
              <DatePicker
                value={form.endDate}
                onChange={(nextValue) => onChange('endDate', nextValue)}
                className="sv-campaigndetail-field"
                triggerClassName="sv-ctl-input"
                placeholder="End date"
              />
            </div>

            <div>
              <label className="sv-campaigndetail-label">Budget</label>
              <input
                type="number"
                min="0"
                value={form.budget}
                onChange={(e) => onChange('budget', e.target.value)}
                placeholder="Budget"
                className="sv-ctl-input sv-campaigndetail-field"
              />
            </div>

            <div>
              <label className="sv-campaigndetail-label">Spend</label>
              <input
                type="number"
                min="0"
                value={form.spend}
                onChange={(e) => onChange('spend', e.target.value)}
                placeholder="Spend"
                className="sv-ctl-input sv-campaigndetail-field"
              />
            </div>

            <div>
              <label className="sv-campaigndetail-label">Conversion Rate (%)</label>
              <input
                type="number"
                min="0"
                value={form.conversionRate}
                onChange={(e) => onChange('conversionRate', e.target.value)}
                placeholder="Conversion Rate (%)"
                className="sv-ctl-input sv-campaigndetail-field"
              />
            </div>

            <div>
              <label className="sv-campaigndetail-label">ROI (x)</label>
              <input
                type="number"
                step="0.01"
                value={form.roi}
                onChange={(e) => onChange('roi', e.target.value)}
                placeholder="ROI (x)"
                className="sv-ctl-input sv-campaigndetail-field"
              />
            </div>

            <div>
              <label className="sv-campaigndetail-label">Target Audience</label>
              <input
                value={form.targetAudience}
                onChange={(e) => onChange('targetAudience', e.target.value)}
                placeholder="Target audience"
                className="sv-ctl-input sv-campaigndetail-field"
              />
            </div>

            <div>
              <label className="sv-campaigndetail-label">Goal Type</label>
              <input
                value={form.goalType}
                onChange={(e) => onChange('goalType', e.target.value)}
                placeholder="Goal type"
                className="sv-ctl-input sv-campaigndetail-field"
              />
            </div>

            <div>
              <label className="sv-campaigndetail-label">Goal Value</label>
              <input
                type="number"
                min="0"
                value={form.goalValue}
                onChange={(e) => onChange('goalValue', e.target.value)}
                placeholder="Goal value"
                className="sv-ctl-input sv-campaigndetail-field"
              />
            </div>

            <div>
              <label className="sv-campaigndetail-label">UTM Source</label>
              <input
                value={form.utmSource}
                onChange={(e) => onChange('utmSource', e.target.value)}
                placeholder="UTM Source"
                className="sv-ctl-input sv-campaigndetail-field"
              />
            </div>

            <div>
              <label className="sv-campaigndetail-label">UTM Medium</label>
              <input
                value={form.utmMedium}
                onChange={(e) => onChange('utmMedium', e.target.value)}
                placeholder="UTM Medium"
                className="sv-ctl-input sv-campaigndetail-field"
              />
            </div>

            <div className="sv-campaigndetail-span-2">
              <label className="sv-campaigndetail-label">UTM Campaign</label>
              <input
                value={form.utmCampaign}
                onChange={(e) => onChange('utmCampaign', e.target.value)}
                placeholder="UTM Campaign"
                className="sv-ctl-input sv-campaigndetail-field"
              />
            </div>

            <div className="sv-campaigndetail-span-2">
              <label className="sv-campaigndetail-label">Notes</label>
              <textarea
                value={form.notes}
                onChange={(e) => onChange('notes', e.target.value)}
                placeholder="Notes"
                rows={3}
                className="sv-ctl-input sv-campaigndetail-field sv-campaigndetail-textarea"
              />
            </div>

            <div className="sv-campaigndetail-link-box">
              <p className="sv-campaigndetail-link-title">Linked Leads</p>
              <div className="sv-campaigndetail-link-list">
                {leads.map((lead) => (
                  <label key={lead._id} className="sv-campaigndetail-link-option">
                    <input
                      type="checkbox"
                      checked={form.leadIds.includes(String(lead._id))}
                      onChange={() => onToggleLead(String(lead._id))}
                    />
                    <span>{lead.title || 'Untitled lead'}</span>
                  </label>
                ))}
                {!leads.length ? <p className="sv-campaigndetail-link-empty">No leads available.</p> : null}
              </div>
            </div>

            <div className="sv-campaigndetail-link-box">
              <p className="sv-campaigndetail-link-title">Linked Clients</p>
              <div className="sv-campaigndetail-link-list">
                {clients.map((client) => (
                  <label key={client._id} className="sv-campaigndetail-link-option">
                    <input
                      type="checkbox"
                      checked={form.clientIds.includes(String(client._id))}
                      onChange={() => onToggleClient(String(client._id))}
                    />
                    <span>{client.name || 'Unnamed client'}</span>
                  </label>
                ))}
                {!clients.length ? <p className="sv-campaigndetail-link-empty">No clients available.</p> : null}
              </div>
            </div>
          </div>

          {error ? <p className="sv-campaigndetail-inline-error">{error}</p> : null}

          <div className="sv-campaigndetail-modal-actions">
            <button type="button" onClick={onClose} className="sv-ctl-btn btn-light sv-campaigns-icon-btn">
              <Icon name="close" className="sv-campaigns-btn-icon" />
              <span>Cancel</span>
            </button>
            <button type="submit" disabled={busy} className="sv-ctl-btn btn-primary">
              <Icon name="save" className="sv-campaigns-btn-icon" />
              <span>{busy ? 'Saving...' : 'Save Changes'}</span>
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

  const handleExport = (format) => {
    if (!campaign) return;
    exportRows({
      rows: [
        campaign,
        ...linkedLeads.map((lead) => ({ ...lead, recordType: 'Lead' })),
        ...linkedClients.map((client) => ({ ...client, recordType: 'Client' })),
      ],
      format,
      filename: `campaign-${campaignId}-report`,
      title: `Campaign Report - ${campaign.name || campaignId}`,
      columns: [
        { header: 'Type', value: (row) => row.recordType || 'Campaign' },
        { header: 'Name', value: (row) => row.name || row.title || campaign.name || '-' },
        { header: 'Status', value: (row) => row.status || row.statusId || '-' },
        { header: 'Channel/Source', value: (row) => row.channel || row.source || '-' },
        { header: 'Owner/Company', value: (row) => row.owner || row.lead || row.company || '-' },
        { header: 'Spend/Value', value: (row) => Number(row.spend || row.value || 0) },
        { header: 'Conversion', value: (row) => row.conversionRate ? `${Number(row.conversionRate).toFixed(1)}%` : '-' },
        { header: 'ROI', value: (row) => row.roi ? `${Number(row.roi).toFixed(2)}x` : '-' },
      ],
    });
    setToast({ tone: 'success', message: `${String(format).toUpperCase()} export ready` });
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
    <main className="sv-campaigndetail-page">
      <div className="sv-campaigndetail-stack">
        <section className="sv-card sv-campaigndetail-hero">
          <div className="sv-campaigndetail-hero-main">
            <span className="sv-campaigndetail-eyebrow"><Icon name="campaign" className="text-base" /> Campaign command</span>
            <h1 className="sv-campaigndetail-title">{campaign?.name || 'Campaign'}</h1>
            <p className="sv-campaigndetail-subtitle">{campaign?.channel || '-'} • {campaign?.status || 'draft'}</p>
            <p className="sv-campaigndetail-owner">{campaign?.owner || campaign?.lead || 'Unassigned owner'}</p>
            <div className="sv-campaigndetail-hero-meta">
              <span>{campaign?.startDate ? new Date(campaign.startDate).toLocaleDateString('en-IN') : 'No start date'}</span>
              <span>{campaign?.endDate ? new Date(campaign.endDate).toLocaleDateString('en-IN') : 'No end date'}</span>
              <span>{(campaign?.linkedLeadsCount || 0) + (campaign?.linkedClientsCount || 0)} linked records</span>
            </div>
          </div>

          <div className="sv-campaigndetail-hero-actions">
            {nextActions.includes('active') ? (
              <button disabled={busyAction} onClick={() => handleStatusChange('active')} className="sv-ctl-btn btn-light sv-campaigns-icon-btn">
                <Icon name="play_arrow" className="sv-campaigns-btn-icon" />
                <span>Activate</span>
              </button>
            ) : null}
            {nextActions.includes('paused') ? (
              <button disabled={busyAction} onClick={() => handleStatusChange('paused')} className="sv-ctl-btn btn-light sv-campaigns-icon-btn">
                <Icon name="pause" className="sv-campaigns-btn-icon" />
                <span>Pause</span>
              </button>
            ) : null}
            {nextActions.includes('completed') ? (
              <button disabled={busyAction} onClick={() => handleStatusChange('completed')} className="sv-ctl-btn btn-light sv-campaigns-icon-btn">
                <Icon name="check_circle" className="sv-campaigns-btn-icon" />
                <span>Complete</span>
              </button>
            ) : null}
            <button disabled={busyAction} onClick={startEdit} className="sv-ctl-btn btn-primary sv-campaigns-icon-btn">
              <Icon name="edit" className="sv-campaigns-btn-icon" />
              <span>Edit</span>
            </button>
            <ExportMenu onExport={handleExport} label="Export" disabled={busyAction || !campaign} />
            <button disabled={busyAction} onClick={handleDelete} className="sv-ctl-btn btn-light sv-campaigns-icon-btn sv-campaigndetail-delete-btn">
              <Icon name="delete" className="sv-campaigns-btn-icon" />
              <span>Delete</span>
            </button>
          </div>
        </section>

        {loading ? <p className="sv-campaigndetail-message">Loading campaign...</p> : null}
        {error ? <p className="sv-campaigndetail-message is-error">{error}</p> : null}

        {campaign ? (
          <>
            <section className="sv-campaigndetail-kpis">
              <article className="sv-card sv-campaigndetail-kpi-card is-blue">
                <p className="sv-campaigndetail-kpi-label">Spend</p>
                <p className="sv-campaigndetail-kpi-value">{formatINR(campaign.spend || 0)}</p>
                <p className="sv-campaigndetail-kpi-hint">Budget {formatINR(campaign.budget || 0)}</p>
              </article>
              <article className="sv-card sv-campaigndetail-kpi-card is-green">
                <p className="sv-campaigndetail-kpi-label">ROI</p>
                <p className="sv-campaigndetail-kpi-value" title={`${Number(campaign.roi || 0).toFixed(2)}x`}>{formatCompactMetric(campaign.roi, 'x')}</p>
                <p className="sv-campaigndetail-kpi-hint">Stored campaign ROI</p>
              </article>
              <article className="sv-card sv-campaigndetail-kpi-card is-amber">
                <p className="sv-campaigndetail-kpi-label">Conversion</p>
                <p className="sv-campaigndetail-kpi-value" title={`${Number(campaign.conversionRate || 0).toFixed(1)}%`}>{formatCompactMetric(campaign.conversionRate, '%')}</p>
                <p className="sv-campaigndetail-kpi-hint">Stored conversion rate</p>
              </article>
              <article className="sv-card sv-campaigndetail-kpi-card is-red">
                <p className="sv-campaigndetail-kpi-label">Linked</p>
                <p className="sv-campaigndetail-kpi-value">{campaign.linkedLeadsCount || 0} Leads / {campaign.linkedClientsCount || 0} Clients</p>
                <p className="sv-campaigndetail-kpi-hint">Relationship coverage</p>
              </article>
            </section>

            <section className="sv-campaigndetail-content-grid">
              <article className="sv-card sv-campaigndetail-panel sv-campaigndetail-panel-wide">
                <h2 className="sv-campaigndetail-panel-title">Associated Leads</h2>
                <div className="sv-campaigndetail-list">
                  {linkedLeads.map((lead) => (
                    <div key={lead._id} className="sv-campaigndetail-list-item">
                      <div>
                        <button type="button" className="sv-campaigndetail-item-title sv-name-open-btn" onClick={() => navigate(ROUTES.leads)}>
                          {lead.title || 'Untitled lead'}
                        </button>
                        <p className="sv-campaigndetail-item-meta">{lead.source || '-'} • {lead.statusId || '-'}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => navigate(ROUTES.leads)}
                        className="sv-ctl-btn btn-light sv-campaigns-icon-btn"
                      >
                        <Icon name="open_in_new" className="sv-campaigns-btn-icon" />
                        <span>Open Leads</span>
                      </button>
                    </div>
                  ))}
                  {!linkedLeads.length ? <p className="sv-campaigndetail-empty">No associated leads.</p> : null}
                </div>
              </article>

              <article className="sv-card sv-campaigndetail-panel">
                <h2 className="sv-campaigndetail-panel-title">Converted/Linked Clients</h2>
                <div className="sv-campaigndetail-list">
                  {linkedClients.map((client) => (
                    <div key={client._id} className="sv-campaigndetail-client-item">
                      <button type="button" className="sv-campaigndetail-item-title sv-name-open-btn" onClick={() => navigate(ROUTES.clientDetail.replace(':clientId', client._id))}>
                        {client.name || 'Unnamed client'}
                      </button>
                      <p className="sv-campaigndetail-item-meta">{client.company || '-'} • {client.email || '-'}</p>
                      <button
                        type="button"
                        onClick={() => navigate(ROUTES.clientDetail.replace(':clientId', client._id))}
                        className="sv-ctl-btn btn-light sv-campaigns-icon-btn"
                      >
                        <Icon name="open_in_new" className="sv-campaigns-btn-icon" />
                        <span>Open Client</span>
                      </button>
                    </div>
                  ))}
                  {!linkedClients.length ? <p className="sv-campaigndetail-empty">No linked clients.</p> : null}
                </div>
              </article>
            </section>

            <section className="sv-card sv-campaigndetail-panel">
              <h2 className="sv-campaigndetail-panel-title">Activity Timeline</h2>
              <div className="sv-campaigndetail-timeline">
                {(campaign.timeline || []).map((item, index) => (
                  <div key={item._id || index} className="sv-campaigndetail-timeline-item">
                    <p className="sv-campaigndetail-item-title">{item.action || 'updated'}</p>
                    <p className="sv-campaigndetail-item-meta">{item.message || JSON.stringify(item.payload || {})}</p>
                    <p className="sv-campaigndetail-time">{item.occurredAt ? new Date(item.occurredAt).toLocaleString() : '-'}</p>
                  </div>
                ))}
                {!campaign.timeline?.length ? <p className="sv-campaigndetail-empty">No campaign activity yet.</p> : null}
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
        <div className={`sv-campaigndetail-toast ${toast.tone === 'error' ? 'is-error' : 'is-success'}`}>
          {toast.message}
        </div>
      ) : null}
    </main>
  );
}

export default CampaignDetailPage;


import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/ui/Icon';
import DatePicker from '../../components/ui/DatePicker';
import SelectDropdown from '../../components/ui/SelectDropdown';
import ExportMenu from '../../components/ui/ExportMenu';
import { useCampaigns } from '../../hooks/useCampaigns';
import { useLeads } from '../../hooks/useLeads';
import { useClients } from '../../hooks/useClients';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { campaignsApi, usersApi } from '../../api';
import { ROUTES } from '../../routes/routePaths';
import { useInfiniteScrollTrigger } from '../../hooks/useInfiniteScrollTrigger';
import { compareByRecencyAsc, compareByRecencyDesc } from '../../lib/listSort';
import { exportRows } from '../../lib/exportData';

const STATUS_OPTIONS = ['draft', 'active', 'paused', 'completed'];
const CAMPAIGN_STATUS_OPTIONS = STATUS_OPTIONS.map((status) => ({ value: status, label: status }));
const CAMPAIGN_SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'start_date', label: 'Start date' },
  { value: 'spend', label: 'Spend' },
  { value: 'conversion', label: 'Conversion' },
];
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
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
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

function CreateCampaignModal({
  open,
  form,
  onChange,
  onToggleLead,
  onToggleClient,
  onClose,
  onSubmit,
  busy,
  users,
  leads,
  clients,
  error,
}) {
  if (!open) return null;

  return (
    <div className="sv-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-3">
      <div className="sv-card sv-campaigns-create-modal">
        <div className="sv-campaigns-modal-head">
          <h2 className="sv-campaigns-modal-title">Create Campaign</h2>
          <button
            type="button"
            onClick={onClose}
            className="sv-modal-close-btn"
            aria-label="Close"
          >
            <Icon name="close" className="text-xl" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="sv-campaigns-create-form">
          <section className="sv-campaigns-form-section">
            <h3 className="sv-campaigns-form-section-title">Basic Info</h3>
            <div className="sv-campaigns-form-grid">
              <div>
                <label className="sv-campaigns-label">
                  Campaign Name <span className="text-error">*</span>
                </label>
                <input
                  required
                  value={form.name}
                  onChange={(event) => onChange('name', event.target.value)}
                  placeholder="Campaign name"
                  className="sv-ctl-input sv-campaigns-field"
                />
              </div>

              <div>
                <label className="sv-campaigns-label">Subtitle</label>
                <input
                  value={form.subtitle}
                  onChange={(event) => onChange('subtitle', event.target.value)}
                  placeholder="Subtitle"
                  className="sv-ctl-input sv-campaigns-field"
                />
              </div>

              <div>
                <label className="sv-campaigns-label">
                  Channel <span className="text-error">*</span>
                </label>
                <input
                  required
                  value={form.channel}
                  onChange={(event) => onChange('channel', event.target.value)}
                  placeholder="meta, google, whatsapp..."
                  className="sv-ctl-input sv-campaigns-field"
                />
              </div>

              <div>
                <label className="sv-campaigns-label">
                  Owner / Lead <span className="text-error">*</span>
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
                  triggerClassName="sv-campaigns-field"
                />
              </div>

              <div>
                <label className="sv-campaigns-label">Status</label>
                <SelectDropdown
                  value={form.status}
                  onChange={(nextValue) => onChange('status', nextValue)}
                  options={CAMPAIGN_STATUS_OPTIONS}
                  triggerClassName="sv-campaigns-field"
                />
              </div>
            </div>
          </section>

          <section className="sv-campaigns-form-section">
            <h3 className="sv-campaigns-form-section-title">Timeline & Budget</h3>
            <div className="sv-campaigns-form-grid">
              <div>
                <label className="sv-campaigns-label">
                  Start Date <span className="text-error">*</span>
                </label>
                <DatePicker
                  value={form.startDate}
                  onChange={(nextValue) => onChange('startDate', nextValue)}
                  className="sv-campaigns-field"
                  triggerClassName="sv-ctl-input"
                  placeholder="Start date"
                />
              </div>

              <div>
                <label className="sv-campaigns-label">End Date</label>
                <DatePicker
                  value={form.endDate}
                  onChange={(nextValue) => onChange('endDate', nextValue)}
                  className="sv-campaigns-field"
                  triggerClassName="sv-ctl-input"
                  placeholder="End date"
                />
              </div>

              <div>
                <label className="sv-campaigns-label">Budget</label>
                <input
                  type="number"
                  min="0"
                  value={form.budget}
                  onChange={(event) => onChange('budget', event.target.value)}
                  placeholder="Budget"
                  className="sv-ctl-input sv-campaigns-field"
                />
              </div>

              <div>
                <label className="sv-campaigns-label">Spend</label>
                <input
                  type="number"
                  min="0"
                  value={form.spend}
                  onChange={(event) => onChange('spend', event.target.value)}
                  placeholder="Spend"
                  className="sv-ctl-input sv-campaigns-field"
                />
              </div>
            </div>
          </section>

          <section className="sv-campaigns-form-section">
            <h3 className="sv-campaigns-form-section-title">Goals & Tracking</h3>
            <div className="sv-campaigns-form-grid">
              <div>
                <label className="sv-campaigns-label">Conversion Rate (%)</label>
                <input
                  type="number"
                  min="0"
                  value={form.conversionRate}
                  onChange={(event) => onChange('conversionRate', event.target.value)}
                  placeholder="Conversion Rate (%)"
                  className="sv-ctl-input sv-campaigns-field"
                />
              </div>

              <div>
                <label className="sv-campaigns-label">ROI (x)</label>
                <input
                  type="number"
                  step="0.01"
                  value={form.roi}
                  onChange={(event) => onChange('roi', event.target.value)}
                  placeholder="ROI (x)"
                  className="sv-ctl-input sv-campaigns-field"
                />
              </div>

              <div>
                <label className="sv-campaigns-label">Target Audience</label>
                <input
                  value={form.targetAudience}
                  onChange={(event) => onChange('targetAudience', event.target.value)}
                  placeholder="Target audience"
                  className="sv-ctl-input sv-campaigns-field"
                />
              </div>

              <div>
                <label className="sv-campaigns-label">Goal Type</label>
                <input
                  value={form.goalType}
                  onChange={(event) => onChange('goalType', event.target.value)}
                  placeholder="Goal type"
                  className="sv-ctl-input sv-campaigns-field"
                />
              </div>

              <div>
                <label className="sv-campaigns-label">Goal Value</label>
                <input
                  type="number"
                  min="0"
                  value={form.goalValue}
                  onChange={(event) => onChange('goalValue', event.target.value)}
                  placeholder="Goal value"
                  className="sv-ctl-input sv-campaigns-field"
                />
              </div>

              <div>
                <label className="sv-campaigns-label">UTM Source</label>
                <input
                  value={form.utmSource}
                  onChange={(event) => onChange('utmSource', event.target.value)}
                  placeholder="UTM Source"
                  className="sv-ctl-input sv-campaigns-field"
                />
              </div>

              <div>
                <label className="sv-campaigns-label">UTM Medium</label>
                <input
                  value={form.utmMedium}
                  onChange={(event) => onChange('utmMedium', event.target.value)}
                  placeholder="UTM Medium"
                  className="sv-ctl-input sv-campaigns-field"
                />
              </div>

              <div className="sv-campaigns-span-2">
                <label className="sv-campaigns-label">UTM Campaign</label>
                <input
                  value={form.utmCampaign}
                  onChange={(event) => onChange('utmCampaign', event.target.value)}
                  placeholder="UTM Campaign"
                  className="sv-ctl-input sv-campaigns-field"
                />
              </div>

              <div className="sv-campaigns-span-2">
                <label className="sv-campaigns-label">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(event) => onChange('notes', event.target.value)}
                  placeholder="Notes"
                  rows={3}
                  className="sv-ctl-input sv-campaigns-field sv-campaigns-textarea"
                />
              </div>
            </div>
          </section>

          <section className="sv-campaigns-form-section">
            <h3 className="sv-campaigns-form-section-title">Linking (Leads/Clients)</h3>
            <div className="sv-campaigns-form-grid">
              <div className="sv-campaigns-link-box">
                <p className="sv-campaigns-link-title">Link Leads</p>
                <div className="sv-campaigns-link-list">
                  {leads.map((lead) => (
                    <label key={lead._id} className="sv-campaigns-link-option">
                      <input
                        type="checkbox"
                        checked={form.leadIds.includes(String(lead._id))}
                        onChange={() => onToggleLead(String(lead._id))}
                      />
                      <span>{lead.title || 'Untitled lead'}</span>
                    </label>
                  ))}
                  {!leads.length ? <p className="sv-campaigns-link-empty">No leads available.</p> : null}
                </div>
              </div>

              <div className="sv-campaigns-link-box">
                <p className="sv-campaigns-link-title">Link Clients</p>
                <div className="sv-campaigns-link-list">
                  {clients.map((client) => (
                    <label key={client._id} className="sv-campaigns-link-option">
                      <input
                        type="checkbox"
                        checked={form.clientIds.includes(String(client._id))}
                        onChange={() => onToggleClient(String(client._id))}
                      />
                      <span>{client.name || 'Unnamed client'}</span>
                    </label>
                  ))}
                  {!clients.length ? <p className="sv-campaigns-link-empty">No clients available.</p> : null}
                </div>
              </div>
            </div>
          </section>

          {error ? <p className="sv-campaigns-inline-error">{error}</p> : null}

          <div className="sv-campaigns-modal-actions">
            <button type="button" onClick={onClose} className="sv-ctl-btn btn-light sv-campaigns-icon-btn" disabled={busy}>
              <Icon name="close" className="sv-campaigns-btn-icon" />
              <span>Cancel</span>
            </button>
            <button type="submit" disabled={busy} className="sv-ctl-btn btn-primary sv-campaigns-icon-btn sv-campaigns-submit-btn">
              <Icon name="add_circle" className="sv-campaigns-btn-icon" />
              <span>{busy ? 'Creating...' : 'Create Campaign'}</span>
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
  const { items: campaignItems, loading, loadingMore, hasMore, loadMore, error, createItem, refresh } = useCampaigns();
  const { items: leadItems } = useLeads();
  const { clients, list: listClients } = useClients();

  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [archiveScope, setArchiveScope] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [createOpen, setCreateOpen] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createForm, setCreateForm] = useState(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [toast, setToast] = useState(null);
  const [openRowMenuId, setOpenRowMenuId] = useState('');
  const [openRowMenuPos, setOpenRowMenuPos] = useState({ top: 0, left: 0 });
  const [openRowMenuCampaign, setOpenRowMenuCampaign] = useState(null);
  const rowMenuRef = useRef(null);
  const listScrollRef = useRef(null);
  const loadMoreCampaignsRef = useInfiniteScrollTrigger({
    rootRef: listScrollRef,
    onIntersect: () => {
      if (hasMore && !loadingMore) void loadMore();
    },
    disabled: !hasMore || loadingMore,
  });

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
      if (sortBy === 'newest') return compareByRecencyDesc(a, b);
      if (sortBy === 'oldest') return compareByRecencyAsc(a, b);
      if (sortBy === 'start_date') {
        return new Date(b.startDate || 0).getTime() - new Date(a.startDate || 0).getTime();
      }
      if (sortBy === 'spend') {
        return Number(b.spend || 0) - Number(a.spend || 0);
      }
      if (sortBy === 'conversion') {
        return Number(b.conversionRate || 0) - Number(a.conversionRate || 0);
      }
      return compareByRecencyDesc(a, b);
    });
  }, [campaignItems, search, statusFilter, sortBy, archiveScope]);

  useEffect(() => {
    listScrollRef.current?.scrollTo({ top: 0 });
  }, [search, statusFilter, archiveScope, sortBy]);

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
      completed: campaigns.filter((item) => String(item.status || '').toLowerCase() === 'completed').length,
      linked: campaigns.reduce((sum, item) => sum + Number(item.linkedLeadsCount || 0) + Number(item.linkedClientsCount || 0), 0),
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

  const handleExportAll = (format) => {
    exportRows({
      rows: campaigns,
      format,
      filename: `campaign-report-${new Date().toISOString().slice(0, 10)}`,
      title: 'Campaign Report',
      columns: [
        { header: 'Campaign', value: (row) => row.name || 'Untitled Campaign' },
        { header: 'Channel', value: (row) => row.channel || row.subtitle || '-' },
        { header: 'Status', value: (row) => row.status || 'draft' },
        { header: 'Owner', value: (row) => row.owner || row.lead || '-' },
        { header: 'Spend', value: (row) => Number(row.spend || 0) },
        { header: 'Conversion', value: (row) => `${Number(row.conversionRate || 0).toFixed(1)}%` },
        { header: 'ROI', value: (row) => `${Number(row.roi || 0).toFixed(2)}x` },
      ],
    });
    setToast({ tone: 'success', message: `${String(format).toUpperCase()} export ready` });
  };

  const closeRowMenu = useCallback(() => {
    setOpenRowMenuId('');
    setOpenRowMenuCampaign(null);
  }, []);

  const openRowMenu = useCallback((event, campaign) => {
    event.stopPropagation();
    const id = String(campaign?._id || '');
    if (!id) return;
    if (openRowMenuId === id) {
      closeRowMenu();
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const menuWidth = 220;
    const menuHeight = 150;
    const placeAbove = window.innerHeight - rect.bottom < menuHeight && rect.top > menuHeight + 12;

    const top = placeAbove
      ? Math.max(8, rect.top - menuHeight - 6)
      : Math.min(window.innerHeight - menuHeight - 8, rect.bottom + 6);
    const left = Math.min(window.innerWidth - menuWidth - 8, Math.max(8, rect.right - menuWidth));

    setOpenRowMenuPos({ top, left });
    setOpenRowMenuCampaign(campaign);
    setOpenRowMenuId(id);
  }, [closeRowMenu, openRowMenuId]);

  useEffect(() => {
    if (!openRowMenuId) return undefined;

    const handlePointerDown = (event) => {
      const target = event.target;
      if (rowMenuRef.current?.contains(target)) return;
      if (target instanceof Element && target.closest('[data-row-menu-trigger="true"]')) return;
      closeRowMenu();
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') closeRowMenu();
    };

    window.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('keydown', handleEscape);
    window.addEventListener('resize', closeRowMenu);
    window.addEventListener('scroll', closeRowMenu, true);

    return () => {
      window.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('keydown', handleEscape);
      window.removeEventListener('resize', closeRowMenu);
      window.removeEventListener('scroll', closeRowMenu, true);
    };
  }, [openRowMenuId, closeRowMenu]);

  return (
    <main className="sv-campaigns-page">
      <div className="sv-campaigns-stack">
        <header className="sv-campaigns-header sv-card">
          <div className="sv-campaigns-header-main">
            <span className="sv-campaigns-eyebrow"><Icon name="campaign" className="text-base" /> Growth workspace</span>
            <h1 className="sv-campaigns-title">Campaign Overview</h1>
            <p className="sv-campaigns-subtitle">
              {campaigns.length} visible campaign{campaigns.length === 1 ? '' : 's'} across {metrics.linked} linked relationship{metrics.linked === 1 ? '' : 's'}.
            </p>
          </div>
          <div className="sv-campaigns-header-actions">
            <ExportMenu onExport={handleExportAll} label="Export Report" disabled={!campaigns.length} />
            <button type="button" onClick={openCreate} className="sv-ctl-btn btn-primary sv-campaigns-new-btn">
              <Icon name="add_circle" className="sv-campaigns-new-icon" />
              <span>New Campaign</span>
            </button>
          </div>
        </header>

        <section className="sv-campaigns-metrics">
          <article className="sv-card sv-campaigns-metric-card is-blue">
            <p className="sv-campaigns-metric-label">Total Active Campaigns</p>
            <p className="sv-campaigns-metric-value">{metrics.active}</p>
            <p className="sv-campaigns-metric-hint">{metrics.total} total visible</p>
          </article>
          <article className="sv-card sv-campaigns-metric-card is-green">
            <p className="sv-campaigns-metric-label">Conversion Rate</p>
            <p className="sv-campaigns-metric-value" title={`${metrics.avgConversion}%`}>{formatCompactMetric(metrics.avgConversion, '%')}</p>
            <p className="sv-campaigns-metric-hint">Average across filtered campaigns</p>
          </article>
          <article className="sv-card sv-campaigns-metric-card is-amber">
            <p className="sv-campaigns-metric-label">Average ROI</p>
            <p className="sv-campaigns-metric-value" title={`${metrics.avgRoi}x`}>{formatCompactMetric(metrics.avgRoi, 'x')}</p>
            <p className="sv-campaigns-metric-hint">{metrics.completed} completed</p>
          </article>
          <article className="sv-card sv-campaigns-metric-card is-red">
            <p className="sv-campaigns-metric-label">Total Spend</p>
            <p className="sv-campaigns-metric-value">{formatINR(metrics.spend)}</p>
            <p className="sv-campaigns-metric-hint">Current filtered spend</p>
          </article>
        </section>

        <section className="sv-card sv-campaigns-table-card">
          <div className="sv-campaigns-table-head">
            <h2 className="sv-campaigns-table-title">Active Initiatives</h2>
            <div className="sv-campaigns-filter-bar">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search campaign/channel/owner"
                className="sv-ctl-input sv-campaigns-search"
              />
              <button
                type="button"
                className={`sv-ctl-btn btn-light sv-campaigns-filter-toggle ${filtersOpen ? 'is-active' : ''}`}
                onClick={() => setFiltersOpen((prev) => !prev)}
              >
                <Icon name="filter_list" className="sv-icon-btn-icon" />
                <span>Filter</span>
              </button>
            </div>
            {filtersOpen ? (
              <div className="sv-campaigns-filter-panel">
                <SelectDropdown value={statusFilter} onChange={setStatusFilter} options={[{ value: 'all', label: 'All status' }, ...CAMPAIGN_STATUS_OPTIONS]} triggerClassName="sv-ctl-select" />
                <SelectDropdown value={archiveScope} onChange={setArchiveScope} options={[{ value: 'all', label: 'All (Active)' }, { value: 'archived', label: 'Archived only' }]} triggerClassName="sv-ctl-select" />
                <SelectDropdown value={sortBy} onChange={setSortBy} options={CAMPAIGN_SORT_OPTIONS} triggerClassName="sv-ctl-select" />
              </div>
            ) : null}
          </div>

          {error ? <p className="sv-campaigns-alert is-error">{error}</p> : null}

          <div className="sv-campaigns-table-wrap sv-list-scroll" ref={listScrollRef}>
            <table className="sv-campaigns-table">
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Status</th>
                  <th>Owner</th>
                  <th>Spend</th>
                  <th>Conversion</th>
                  <th className="sv-row-action-heading">Actions</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((campaign) => {
                  const status = String(campaign.status || 'draft').toLowerCase();
                  return (
                    <tr key={campaign._id}>
                      <td>
                        <div className="sv-campaigns-campaign-cell">
                          <button
                            type="button"
                            className="sv-campaigns-campaign-title sv-name-open-btn"
                            onClick={() => navigate(ROUTES.campaignDetail.replace(':campaignId', campaign._id))}
                          >
                            {campaign.name || 'Untitled Campaign'}
                          </button>
                          {campaign?.isArchived ? (
                            <span className="sv-campaigns-archive-chip">Archived</span>
                          ) : null}
                        </div>
                        <p className="sv-campaigns-campaign-subtitle">{campaign.channel || campaign.subtitle || 'Campaign'}</p>
                      </td>
                      <td>
                        <span className={`sv-campaigns-status-chip is-${status}`}>{campaign.status || 'draft'}</span>
                      </td>
                      <td>{campaign.owner || campaign.lead || '-'}</td>
                      <td>{formatINR(campaign.spend || 0)}</td>
                      <td title={`${Number(campaign.conversionRate || 0).toFixed(1)}%`}>{formatCompactMetric(campaign.conversionRate, '%')}</td>
                      <td className="sv-row-action-cell">
                        <div className="sv-row-menu-container">
                          <button
                            type="button"
                            className="sv-row-menu-btn"
                            data-row-menu-trigger="true"
                            aria-label="Open actions"
                            aria-expanded={openRowMenuId === String(campaign._id)}
                            onClick={(event) => openRowMenu(event, campaign)}
                          >
                            <Icon name="more_vert" className="text-lg" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {!campaigns.length && !loading ? (
                  <tr>
                    <td colSpan={6} className="sv-campaigns-empty-cell">
                      No campaigns available.
                    </td>
                  </tr>
                ) : null}
                {campaigns.length ? (
                  <tr>
                    <td colSpan={6} className="sv-list-sentinel-cell">
                      <span ref={loadMoreCampaignsRef} className="sv-list-sentinel" />
                      {loadingMore ? 'Loading more campaigns...' : hasMore ? 'Scroll for more' : 'End of list'}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {openRowMenuId && openRowMenuCampaign ? (
        <div
          ref={rowMenuRef}
          className="sv-row-menu-popover sv-row-menu-popover-fixed"
          style={{ top: `${openRowMenuPos.top}px`, left: `${openRowMenuPos.left}px` }}
        >
          <button
            type="button"
            className="sv-row-menu-item"
            onClick={() => {
              const row = openRowMenuCampaign;
              closeRowMenu();
              navigate(ROUTES.campaignDetail.replace(':campaignId', row._id));
            }}
          >
            <Icon name="open_in_new" className="sv-icon-btn-icon" />
            <span>Open</span>
          </button>
          <button
            type="button"
            className="sv-row-menu-item"
            onClick={() => {
              const row = openRowMenuCampaign;
              closeRowMenu();
              handleDuplicate(row._id);
            }}
          >
            <Icon name="content_copy" className="sv-icon-btn-icon" />
            <span>Duplicate</span>
          </button>
          <button
            type="button"
            className="sv-row-menu-item is-danger"
            onClick={() => {
              const row = openRowMenuCampaign;
              closeRowMenu();
              setDeleteTarget(row);
            }}
          >
            <Icon name={openRowMenuCampaign?.isArchived ? 'unarchive' : 'archive'} className="sv-icon-btn-icon" />
            <span>{openRowMenuCampaign?.isArchived ? 'Unarchive' : 'Archive'}</span>
          </button>
        </div>
      ) : null}

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
        <div className="sv-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-3">
          <div className="sv-card sv-campaigns-confirm-modal">
            <h3 className="sv-campaigns-confirm-title">
              {deleteTarget?.isArchived ? 'Unarchive Campaign?' : 'Archive Campaign?'}
            </h3>
            <p className="sv-campaigns-confirm-text">
              {deleteTarget?.isArchived
                ? `${deleteTarget.name} will move back to active records.`
                : `${deleteTarget.name} will be removed from active records.`}
            </p>
            <div className="sv-campaigns-confirm-actions">
              <button type="button" onClick={() => setDeleteTarget(null)} className="sv-ctl-btn btn-light sv-campaigns-icon-btn">
                <Icon name="close" className="sv-campaigns-btn-icon" />
                <span>Cancel</span>
              </button>
              <button
                type="button"
                onClick={handleArchiveToggle}
                className={`sv-ctl-btn sv-campaigns-icon-btn ${deleteTarget?.isArchived ? 'btn-primary' : 'btn-danger'}`}
              >
                <Icon
                  name={deleteTarget?.isArchived ? 'unarchive' : 'archive'}
                  className="sv-campaigns-btn-icon"
                />
                <span>{deleteTarget?.isArchived ? 'Unarchive' : 'Archive'}</span>
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className={`sv-campaigns-toast ${toast.tone === 'error' ? 'is-error' : 'is-success'}`}>
          {toast.message}
        </div>
      ) : null}
    </main>
  );
}

export default CampaignsPage;

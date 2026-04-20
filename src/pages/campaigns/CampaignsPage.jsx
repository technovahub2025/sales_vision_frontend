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
const PAGE_SIZE_OPTIONS = [8, 15, 25];

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

function PaginationControls({
  totalItems,
  currentPage,
  totalPages,
  pageSize,
  onPageChange,
  onPageSizeChange,
}) {
  const start = totalItems ? (currentPage - 1) * pageSize + 1 : 0;
  const end = totalItems ? Math.min(currentPage * pageSize, totalItems) : 0;

  const buildPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    const pages = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
    if (currentPage <= 3) {
      pages.add(2);
      pages.add(3);
      pages.add(4);
    }
    if (currentPage >= totalPages - 2) {
      pages.add(totalPages - 1);
      pages.add(totalPages - 2);
      pages.add(totalPages - 3);
    }

    return [...pages].filter((page) => page >= 1 && page <= totalPages).sort((a, b) => a - b);
  };

  const pages = buildPageNumbers();

  return (
    <div className="sv-campaigns-pagination">
      <div className="sv-campaigns-pagination-meta">
        <span className="sv-campaigns-pagination-text">Showing {start}-{end} of {totalItems}</span>
        <label className="sv-campaigns-pagination-size" htmlFor="campaignRowsPerPage">
          <span>Rows per page</span>
          <select
            id="campaignRowsPerPage"
            className="sv-ctl-select sv-campaigns-page-size"
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
          >
            {PAGE_SIZE_OPTIONS.map((option) => (
              <option key={option} value={option}>{option}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="sv-campaigns-pagination-controls">
        <button
          type="button"
          className="sv-ctl-btn btn-light"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
        >
          Prev
        </button>

        <div className="sv-campaigns-page-list">
          {pages.map((page, index) => {
            const previous = pages[index - 1];
            const showGap = previous && page - previous > 1;

            return (
              <span key={page} className="sv-campaigns-page-item">
                {showGap ? <span className="sv-campaigns-page-ellipsis">...</span> : null}
                <button
                  type="button"
                  className={`sv-campaigns-page-btn ${page === currentPage ? 'is-active' : ''}`}
                  onClick={() => onPageChange(page)}
                >
                  {page}
                </button>
              </span>
            );
          })}
        </div>

        <button
          type="button"
          className="sv-ctl-btn btn-light"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
        >
          Next
        </button>
      </div>
    </div>
  );
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
                <select
                  required
                  value={form.ownerId}
                  onChange={(event) => {
                    const selectedId = event.target.value;
                    const selected = users.find((user) => String(user._id) === String(selectedId));
                    onChange('ownerId', selectedId);
                    onChange('owner', selected?.displayName || selected?.name || selected?.email || '');
                    onChange('lead', selected?.displayName || selected?.name || selected?.email || '');
                  }}
                  className="sv-ctl-select sv-campaigns-field"
                >
                  <option value="">Select owner/lead</option>
                  {users.map((user) => (
                    <option key={user._id} value={user._id}>
                      {user.displayName || user.name || user.email || 'Unknown'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="sv-campaigns-label">Status</label>
                <select
                  value={form.status}
                  onChange={(event) => onChange('status', event.target.value)}
                  className="sv-ctl-select sv-campaigns-field"
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
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
                <input
                  type="date"
                  required
                  value={form.startDate}
                  onChange={(event) => onChange('startDate', event.target.value)}
                  className="sv-ctl-input sv-campaigns-field"
                />
              </div>

              <div>
                <label className="sv-campaigns-label">End Date</label>
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(event) => onChange('endDate', event.target.value)}
                  className="sv-ctl-input sv-campaigns-field"
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
            <button type="submit" disabled={busy} className="sv-ctl-btn btn-primary">
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
  const { items: campaignItems, loading, error, createItem, refresh } = useCampaigns();
  const { items: leadItems } = useLeads();
  const { clients, list: listClients } = useClients();

  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [archiveScope, setArchiveScope] = useState('all');
  const [sortBy, setSortBy] = useState('recent');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
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

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, archiveScope, sortBy, pageSize]);

  const totalItems = campaigns.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const pagedCampaigns = useMemo(() => {
    const start = (safeCurrentPage - 1) * pageSize;
    return campaigns.slice(start, start + pageSize);
  }, [campaigns, safeCurrentPage, pageSize]);

  useEffect(() => {
    if (currentPage !== safeCurrentPage) {
      setCurrentPage(safeCurrentPage);
    }
  }, [currentPage, safeCurrentPage]);

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
      const report = await campaignsApi.exportReport(workspaceId, null, undefined, {
        includeArchived: 'true',
      });
      downloadJson(`campaign-report-${new Date().toISOString().slice(0, 10)}.json`, report.data || report);
      setToast({ tone: 'success', message: 'Report exported' });
    } catch (nextError) {
      setToast({ tone: 'error', message: nextError.message || 'Failed to export report' });
    }
  };

  return (
    <main className="sv-campaigns-page">
      <div className="sv-campaigns-stack">
        <header className="sv-campaigns-header sv-card">
          <div className="sv-campaigns-header-main">
            <h1 className="sv-campaigns-title">Campaign Overview</h1>
            <p className="sv-campaigns-subtitle">Lead generation campaigns with actionable detail workflows.</p>
          </div>
          <div className="sv-campaigns-header-actions">
            <button type="button" onClick={handleExportAll} className="sv-ctl-btn btn-light sv-campaigns-icon-btn">
              <Icon name="download" className="sv-campaigns-btn-icon" />
              <span>Export Report</span>
            </button>
            <button type="button" onClick={openCreate} className="sv-ctl-btn btn-primary sv-campaigns-new-btn">
              <Icon name="add_circle" className="sv-campaigns-new-icon" />
              <span>New Campaign</span>
            </button>
          </div>
        </header>

        <section className="sv-campaigns-metrics">
          <article className="sv-card sv-campaigns-metric-card">
            <p className="sv-campaigns-metric-label">Total Active Campaigns</p>
            <p className="sv-campaigns-metric-value">{metrics.active}</p>
          </article>
          <article className="sv-card sv-campaigns-metric-card">
            <p className="sv-campaigns-metric-label">Conversion Rate</p>
            <p className="sv-campaigns-metric-value">{metrics.avgConversion}%</p>
          </article>
          <article className="sv-card sv-campaigns-metric-card">
            <p className="sv-campaigns-metric-label">Average ROI</p>
            <p className="sv-campaigns-metric-value">{metrics.avgRoi}x</p>
          </article>
          <article className="sv-card sv-campaigns-metric-card">
            <p className="sv-campaigns-metric-label">Total Spend</p>
            <p className="sv-campaigns-metric-value">{formatINR(metrics.spend)}</p>
          </article>
        </section>

        <section className="sv-card sv-campaigns-table-card">
          <div className="sv-campaigns-table-head">
            <h2 className="sv-campaigns-table-title">Active Initiatives</h2>
            <div className="sv-campaigns-controls">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search campaign/channel/owner"
                className="sv-ctl-input sv-campaigns-search"
              />
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="sv-ctl-select"
              >
                <option value="all">All status</option>
                {STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
              <select
                value={archiveScope}
                onChange={(event) => setArchiveScope(event.target.value)}
                className="sv-ctl-select"
              >
                <option value="all">All (Active)</option>
                <option value="archived">Archived only</option>
              </select>
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} className="sv-ctl-select">
                <option value="recent">Recently updated</option>
                <option value="start_date">Start date</option>
                <option value="spend">Spend</option>
                <option value="conversion">Conversion</option>
              </select>
            </div>
          </div>

          {error ? <p className="sv-campaigns-alert is-error">{error}</p> : null}

          <div className="sv-campaigns-table-wrap">
            <table className="sv-campaigns-table">
              <thead>
                <tr>
                  <th>Campaign</th>
                  <th>Status</th>
                  <th>Owner</th>
                  <th>Spend</th>
                  <th>Conversion</th>
                  <th className="is-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedCampaigns.map((campaign) => {
                  const status = String(campaign.status || 'draft').toLowerCase();
                  return (
                    <tr key={campaign._id}>
                      <td>
                        <div className="sv-campaigns-campaign-cell">
                          <p className="sv-campaigns-campaign-title">{campaign.name || 'Untitled Campaign'}</p>
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
                      <td>{Number(campaign.conversionRate || 0).toFixed(1)}%</td>
                      <td className="is-right">
                        <div className="sv-campaigns-actions">
                          <button
                            type="button"
                            onClick={() => navigate(ROUTES.campaignDetail.replace(':campaignId', campaign._id))}
                            className="sv-ctl-btn btn-light sv-campaigns-icon-btn"
                          >
                            <Icon name="open_in_new" className="sv-campaigns-btn-icon" />
                            <span>Open</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDuplicate(campaign._id)}
                            className="sv-ctl-btn btn-light sv-campaigns-icon-btn"
                          >
                            <Icon name="content_copy" className="sv-campaigns-btn-icon" />
                            <span>Duplicate</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(campaign)}
                            className={`sv-ctl-btn sv-campaigns-icon-btn ${campaign?.isArchived ? 'btn-primary' : 'btn-light sv-campaigns-archive-btn'}`}
                          >
                            <Icon
                              name={campaign?.isArchived ? 'unarchive' : 'archive'}
                              className="sv-campaigns-btn-icon"
                            />
                            <span>{campaign?.isArchived ? 'Unarchive' : 'Archive'}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {!pagedCampaigns.length && !loading ? (
                  <tr>
                    <td colSpan={6} className="sv-campaigns-empty-cell">
                      No campaigns available.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          <PaginationControls
            totalItems={totalItems}
            currentPage={safeCurrentPage}
            totalPages={totalPages}
            pageSize={pageSize}
            onPageChange={setCurrentPage}
            onPageSizeChange={setPageSize}
          />
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

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLeads } from '../../hooks/useLeads';
import { useClients } from '../../hooks/useClients';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { clientsApi, leadsApi } from '../../api';
import { ROUTES } from '../../routes/routePaths';

const STAGES = [
  { statusId: 'new', title: 'New' },
  { statusId: 'contacted', title: 'Contacted' },
  { statusId: 'qualified', title: 'Qualified' },
  { statusId: 'proposal_sent', title: 'Proposal Sent' },
  { statusId: 'negotiation', title: 'Negotiation' },
  { statusId: 'won', title: 'Won' },
  { statusId: 'lost', title: 'Lost' },
];
const STAGE_IDS = new Set(STAGES.map((s) => s.statusId));
const PRIORITY_VALUES = ['cold', 'warm', 'hot'];
const SOURCE_VALUES = ['organic', 'referral', 'cold', 'paid', 'event'];
const DEFAULT_PAGE_SIZE = 8;
const PAGE_SIZE_OPTIONS = [8, 15, 25];
const EMPTY_DETAIL_FIELDS = {
  leadType: 'company',
  contactName: '',
  companyName: '',
  email: '',
  phone: '',
  designation: '',
  website: '',
  address: '',
  taxId: '',
  city: '',
  state: '',
  country: '',
  pincode: '',
  alternatePhone: '',
};

const normStage = (v) => (STAGE_IDS.has(String(v || '')) ? String(v) : 'new');
const stageTitle = (id) => STAGES.find((s) => s.statusId === normStage(id))?.title || 'New';
const leadId = (l) => String(l?._id || l?.id || '');
const fmtInr = (v) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(v || 0));
const fmtDate = (v) => {
  if (!v) return '-';
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleString('en-IN');
};
const obj = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const nSource = (v) => (SOURCE_VALUES.includes(String(v || '').toLowerCase()) ? String(v).toLowerCase() : 'organic');
const nPriority = (v) => (PRIORITY_VALUES.includes(String(v || '').toLowerCase()) ? String(v).toLowerCase() : 'warm');
const extractDetails = (cf) => ({ ...EMPTY_DETAIL_FIELDS, ...obj(cf), leadType: String(obj(cf).leadType || obj(cf).type || 'company') });
const mapClientToLeadFields = (client) => ({
  contactName: String(client?.name || ''),
  companyName: String(client?.company || ''),
  email: String(client?.email || ''),
  phone: String(client?.phone || ''),
  website: String(client?.website || ''),
  address: String(client?.address || ''),
});
const createDefaults = () => ({
  title: '',
  statusId: 'new',
  value: '',
  priority: 'warm',
  source: 'organic',
  expectedCloseDate: '',
  clientId: '',
  ...EMPTY_DETAIL_FIELDS,
});
const editDefaults = () => ({
  title: '',
  value: '',
  priority: 'warm',
  source: 'organic',
  expectedCloseDate: '',
  clientId: '',
  ...EMPTY_DETAIL_FIELDS,
});
const toCustomFields = (form) => ({
  leadType: String(form.leadType || 'company'),
  contactName: String(form.contactName || ''),
  companyName: String(form.companyName || ''),
  email: String(form.email || ''),
  phone: String(form.phone || ''),
  designation: String(form.designation || ''),
  website: String(form.website || ''),
  address: String(form.address || ''),
  taxId: String(form.taxId || ''),
  city: String(form.city || ''),
  state: String(form.state || ''),
  country: String(form.country || ''),
  pincode: String(form.pincode || ''),
  alternatePhone: String(form.alternatePhone || ''),
});
const toEditFormFromLead = (lead) => {
  const details = extractDetails(lead?.customFields);
  return {
    ...editDefaults(),
    title: String(lead?.title || ''),
    value: String(lead?.value ?? ''),
    priority: nPriority(lead?.priority),
    source: nSource(lead?.source),
    expectedCloseDate: lead?.expectedCloseDate ? String(lead.expectedCloseDate).slice(0, 10) : '',
    clientId: String(lead?.clientId || ''),
    ...details,
  };
};
const CLIENT_FORM_DEFAULTS = {
  name: '',
  company: '',
  email: '',
  phone: '',
  website: '',
  address: '',
  contactName: '',
  designation: '',
  alternatePhone: '',
  taxId: '',
  city: '',
  state: '',
  country: '',
  pincode: '',
};
const toClientPayload = (form) => ({
  name: String(form.name || '').trim(),
  company: String(form.company || '').trim(),
  email: String(form.email || '').trim(),
  phone: String(form.phone || '').trim(),
  website: String(form.website || '').trim(),
  address: String(form.address || '').trim(),
  contactName: String(form.contactName || '').trim(),
  designation: String(form.designation || '').trim(),
  alternatePhone: String(form.alternatePhone || '').trim(),
  taxId: String(form.taxId || '').trim(),
  city: String(form.city || '').trim(),
  state: String(form.state || '').trim(),
  country: String(form.country || '').trim(),
  pincode: String(form.pincode || '').trim(),
  customFields: {
    contactName: String(form.contactName || '').trim(),
    designation: String(form.designation || '').trim(),
    alternatePhone: String(form.alternatePhone || '').trim(),
    taxId: String(form.taxId || '').trim(),
    city: String(form.city || '').trim(),
    state: String(form.state || '').trim(),
    country: String(form.country || '').trim(),
    pincode: String(form.pincode || '').trim(),
  },
});

function DetailFields({ form, setForm }) {
  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  return (
    <>
      <div className="sv-leads-detail-row grid grid-cols-2 gap-2">
        <select value={form.leadType} onChange={(e) => set('leadType', e.target.value)} className="rounded-lg border border-outline-variant/20 px-3 py-2 text-sm">
          <option value="company">Company</option>
          <option value="person">Person</option>
        </select>
        <input value={form.contactName} onChange={(e) => set('contactName', e.target.value)} placeholder="Contact Name" className="rounded-lg border border-outline-variant/20 px-3 py-2 text-sm" />
      </div>
      <div className="sv-leads-detail-row grid grid-cols-2 gap-2">
        <input value={form.companyName} onChange={(e) => set('companyName', e.target.value)} placeholder="Company Name" className="rounded-lg border border-outline-variant/20 px-3 py-2 text-sm" />
        <input value={form.designation} onChange={(e) => set('designation', e.target.value)} placeholder="Designation" className="rounded-lg border border-outline-variant/20 px-3 py-2 text-sm" />
      </div>
      <div className="sv-leads-detail-row grid grid-cols-2 gap-2">
        <input value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="Email" className="rounded-lg border border-outline-variant/20 px-3 py-2 text-sm" />
        <input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="Phone" className="rounded-lg border border-outline-variant/20 px-3 py-2 text-sm" />
      </div>
      <div className="sv-leads-detail-row grid grid-cols-2 gap-2">
        <input value={form.alternatePhone} onChange={(e) => set('alternatePhone', e.target.value)} placeholder="Alternate Phone" className="rounded-lg border border-outline-variant/20 px-3 py-2 text-sm" />
        <input value={form.website} onChange={(e) => set('website', e.target.value)} placeholder="Website" className="rounded-lg border border-outline-variant/20 px-3 py-2 text-sm" />
      </div>
      <input value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="Address" className="sv-leads-address-row w-full rounded-lg border border-outline-variant/20 px-3 py-2 text-sm" />
      <div className="sv-leads-detail-row grid grid-cols-2 gap-2">
        <input value={form.taxId} onChange={(e) => set('taxId', e.target.value)} placeholder="GST/Tax ID" className="rounded-lg border border-outline-variant/20 px-3 py-2 text-sm" />
        <input value={form.pincode} onChange={(e) => set('pincode', e.target.value)} placeholder="Pincode" className="rounded-lg border border-outline-variant/20 px-3 py-2 text-sm" />
      </div>
      <div className="sv-leads-detail-row grid grid-cols-3 gap-2">
        <input value={form.city} onChange={(e) => set('city', e.target.value)} placeholder="City" className="rounded-lg border border-outline-variant/20 px-3 py-2 text-sm" />
        <input value={form.state} onChange={(e) => set('state', e.target.value)} placeholder="State" className="rounded-lg border border-outline-variant/20 px-3 py-2 text-sm" />
        <input value={form.country} onChange={(e) => set('country', e.target.value)} placeholder="Country" className="rounded-lg border border-outline-variant/20 px-3 py-2 text-sm" />
      </div>
    </>
  );
}

function PaginationControls({ page, totalPages, totalItems, pageSize, onPageChange, onPageSizeChange }) {
  if (totalItems <= 0) return null;
  const safePage = Math.max(1, Math.min(page, totalPages));
  const startItem = (safePage - 1) * pageSize + 1;
  const endItem = Math.min(totalItems, safePage * pageSize);
  const pages = Array.from({ length: totalPages }, (_, idx) => idx + 1);
  return (
    <div className="sv-leads-pagination">
      <div className="sv-leads-pagination-meta">
        <span className="sv-leads-pagination-text">Showing {startItem}–{endItem} of {totalItems}</span>
        <label className="sv-leads-pagination-size">
          <span>Rows per page</span>
          <select className="form-select form-select-sm sv-ctl-select sv-leads-page-size" value={pageSize} onChange={(e) => onPageSizeChange(Number(e.target.value))}>
            {PAGE_SIZE_OPTIONS.map((size) => <option key={`size-${size}`} value={size}>{size}</option>)}
          </select>
        </label>
      </div>
      <div className="sv-leads-pagination-controls">
        <button type="button" className="btn btn-light btn-sm sv-ctl-btn sv-leads-page-btn" onClick={() => onPageChange(Math.max(1, page - 1))} disabled={page <= 1}>
          Prev
        </button>
        <div className="sv-leads-page-list">
          {pages.map((p) => (
            <button key={`page-${p}`} type="button" className={`btn btn-sm sv-ctl-btn sv-leads-page-btn ${p === page ? 'is-active' : ''}`} onClick={() => onPageChange(p)}>
              {p}
            </button>
          ))}
        </div>
        <button type="button" className="btn btn-light btn-sm sv-ctl-btn sv-leads-page-btn" onClick={() => onPageChange(Math.min(totalPages, page + 1))} disabled={page >= totalPages}>
          Next
        </button>
      </div>
    </div>
  );
}

function LeadManagementPage() {
  const navigate = useNavigate();
  const { workspaceId } = useWorkspace();
  const [tab, setTab] = useState('list');
  const [openCreate, setOpenCreate] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [selectedLead, setSelectedLead] = useState(null);
  const [pendingMove, setPendingMove] = useState(null);
  const [moveBusy, setMoveBusy] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [createClientBusy, setCreateClientBusy] = useState(false);
  const [editBusy, setEditBusy] = useState(false);
  const [openCreateClient, setOpenCreateClient] = useState(false);
  const [toast, setToast] = useState(null);
  const [filters, setFilters] = useState({ search: '', status: 'all', priority: 'all', source: 'all', archiveScope: 'all' });
  const [clientFilters, setClientFilters] = useState({ search: '', archiveScope: 'all' });
  const [leadsPage, setLeadsPage] = useState(1);
  const [clientsPage, setClientsPage] = useState(1);
  const [leadsPageSize, setLeadsPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [clientsPageSize, setClientsPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [createForm, setCreateForm] = useState(createDefaults);
  const [editForm, setEditForm] = useState(editDefaults);
  const [clientForm, setClientForm] = useState(CLIENT_FORM_DEFAULTS);

  const { items: leads, loading: leadsLoading, error: leadsError, refresh: refreshLeads, createItem, updateItem } = useLeads();
  const { clients, loading: clientsLoading, createClient, list: listClients } = useClients();

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const err = useCallback((m) => setToast({ tone: 'error', message: m || 'Something went wrong' }), []);
  const ok = useCallback((m) => setToast({ tone: 'success', message: m || 'Saved' }), []);
  const refreshAll = useCallback(async () => {
    await refreshLeads({ silent: true });
  }, [refreshLeads]);

  const rows = useMemo(
    () => (leads || []).map((l) => ({ ...l, statusId: normStage(l.statusId || l.stage), isArchived: Boolean(l?.isArchived) })),
    [leads],
  );
  const clientLookup = useMemo(() => new Map((clients || []).map((c) => [String(c._id), c])), [clients]);

  const filtered = useMemo(
    () =>
      rows.filter((lead) => {
        const q = String(filters.search || '').trim().toLowerCase();
        const title = String(lead.title || '').toLowerCase();
        if (q && !title.includes(q)) return false;
        if (filters.status !== 'all' && normStage(lead.statusId || lead.stage) !== filters.status) return false;
        if (filters.priority !== 'all' && String(lead.priority || '').toLowerCase() !== filters.priority) return false;
        if (filters.source !== 'all' && String(lead.source || '').toLowerCase() !== filters.source) return false;
        if (filters.archiveScope === 'all' && lead.isArchived) return false;
        if (filters.archiveScope === 'archived' && !lead.isArchived) return false;
        return true;
      }),
    [rows, filters],
  );
  const filteredClients = useMemo(
    () =>
      (clients || []).filter((client) => {
        const q = String(clientFilters.search || '').trim().toLowerCase();
        const haystack = `${String(client?.name || '')} ${String(client?.company || '')} ${String(client?.email || '')} ${String(client?.phone || '')}`.toLowerCase();
        if (q && !haystack.includes(q)) return false;
        if (clientFilters.archiveScope === 'all' && client?.isArchived) return false;
        if (clientFilters.archiveScope === 'archived' && !client?.isArchived) return false;
        return true;
      }),
    [clients, clientFilters],
  );

  const leadsTotalPages = Math.max(1, Math.ceil(filtered.length / leadsPageSize));
  const clientsTotalPages = Math.max(1, Math.ceil(filteredClients.length / clientsPageSize));

  const pagedLeads = useMemo(() => {
    const start = (leadsPage - 1) * leadsPageSize;
    return filtered.slice(start, start + leadsPageSize);
  }, [filtered, leadsPage, leadsPageSize]);

  const pagedClients = useMemo(() => {
    const start = (clientsPage - 1) * clientsPageSize;
    return filteredClients.slice(start, start + clientsPageSize);
  }, [filteredClients, clientsPage, clientsPageSize]);

  const selected = useMemo(() => {
    if (!selectedLead) return null;
    const id = leadId(selectedLead);
    return rows.find((x) => leadId(x) === id) || selectedLead;
  }, [selectedLead, rows]);

  const beginCreate = useCallback(() => {
    setCreateForm(createDefaults());
    setOpenCreate(true);
  }, []);

  const closeCreate = useCallback(() => setOpenCreate(false), []);
  const closeEdit = useCallback(() => setEditingLead(null), []);
  const resetFilters = useCallback(() => setFilters({ search: '', status: 'all', priority: 'all', source: 'all', archiveScope: 'all' }), []);
  const resetClientFilters = useCallback(() => setClientFilters({ search: '', archiveScope: 'all' }), []);

  useEffect(() => {
    setLeadsPage(1);
  }, [filters.search, filters.status, filters.priority, filters.source, filters.archiveScope]);

  useEffect(() => {
    setClientsPage(1);
  }, [clientFilters.search, clientFilters.archiveScope]);

  useEffect(() => {
    setLeadsPage(1);
  }, [leadsPageSize]);

  useEffect(() => {
    setClientsPage(1);
  }, [clientsPageSize]);

  useEffect(() => {
    if (leadsPage > leadsTotalPages) setLeadsPage(leadsTotalPages);
  }, [leadsPage, leadsTotalPages]);

  useEffect(() => {
    if (clientsPage > clientsTotalPages) setClientsPage(clientsTotalPages);
  }, [clientsPage, clientsTotalPages]);

  const openEdit = useCallback(async (lead) => {
    setEditingLead(lead);
    setEditForm(toEditFormFromLead(lead));

    const id = leadId(lead);
    if (!workspaceId || !id) return;
    try {
      const response = await leadsApi.get(workspaceId, id);
      const fullLead = response?.data || null;
      if (!fullLead) return;
      setEditingLead((current) => (leadId(current) === id ? fullLead : current));
      setEditForm(toEditFormFromLead(fullLead));
    } catch (e) {
      err(e.message || 'Failed to load lead details');
    }
  }, [workspaceId, err]);

  const handleCreateClientChange = useCallback((nextClientId) => {
    const id = String(nextClientId || '');
    const mapped = id ? mapClientToLeadFields(clientLookup.get(id)) : null;
    setCreateForm((prev) => ({ ...prev, clientId: id, ...(mapped || {}) }));
  }, [clientLookup]);

  const handleEditClientChange = useCallback((nextClientId) => {
    const id = String(nextClientId || '');
    const mapped = id ? mapClientToLeadFields(clientLookup.get(id)) : null;
    setEditForm((prev) => ({ ...prev, clientId: id, ...(mapped || {}) }));
  }, [clientLookup]);

  const handleCreate = useCallback(async (event) => {
    event.preventDefault();
    const title = String(createForm.title || '').trim();
    if (!title) {
      err('Lead title is required');
      return;
    }
    setCreateBusy(true);
    try {
      await createItem({
        title,
        statusId: normStage(createForm.statusId),
        value: Number(createForm.value || 0),
        priority: nPriority(createForm.priority),
        source: nSource(createForm.source),
        currency: 'INR',
        expectedCloseDate: createForm.expectedCloseDate || undefined,
        clientId: createForm.clientId || undefined,
        customFields: toCustomFields(createForm),
      });
      await refreshAll();
      setOpenCreate(false);
      setCreateForm(createDefaults());
      ok('Lead created');
    } catch (e) {
      err(e.message || 'Failed to create lead');
    } finally {
      setCreateBusy(false);
    }
  }, [createForm, createItem, err, ok, refreshAll]);

  const handleSaveEdit = useCallback(async (event) => {
    event.preventDefault();
    if (!editingLead) return;
    const id = leadId(editingLead);
    if (!id) return;
    setEditBusy(true);
    try {
      const existingCustomFields = obj(editingLead?.customFields);
      await updateItem(id, {
        title: String(editForm.title || '').trim(),
        value: Number(editForm.value || 0),
        priority: nPriority(editForm.priority),
        source: nSource(editForm.source),
        currency: 'INR',
        expectedCloseDate: editForm.expectedCloseDate || null,
        clientId: editForm.clientId || null,
        customFields: { ...existingCustomFields, ...toCustomFields(editForm) },
      });
      await refreshAll();
      setEditingLead(null);
      ok('Lead updated');
    } catch (e) {
      err(e.message || 'Failed to update lead');
    } finally {
      setEditBusy(false);
    }
  }, [editForm, editingLead, err, ok, refreshAll, updateItem]);

  const openMove = useCallback((lead, toStatusId) => {
    const fromStatusId = normStage(lead.statusId || lead.stage);
    const nextStatusId = normStage(toStatusId);
    if (fromStatusId === nextStatusId) return;
    setPendingMove({ leadId: leadId(lead), title: String(lead.title || 'Lead'), fromStatusId, toStatusId: nextStatusId });
  }, []);

  const cancelMove = useCallback(() => setPendingMove(null), []);

  const confirmMove = useCallback(async () => {
    if (!pendingMove || !workspaceId) return;
    setMoveBusy(true);
    try {
      await leadsApi.updateStatus(workspaceId, pendingMove.leadId, pendingMove.toStatusId);
      await refreshAll();
      ok(`Moved to ${stageTitle(pendingMove.toStatusId)}`);
      setPendingMove(null);
    } catch (e) {
      err(e.message || 'Failed to move lead');
    } finally {
      setMoveBusy(false);
    }
  }, [pendingMove, workspaceId, refreshAll, ok, err]);

  const toggleLeadArchive = useCallback(async (lead) => {
    const id = leadId(lead);
    if (!workspaceId || !id) return;
    try {
      if (lead?.isArchived) {
        await leadsApi.restore(workspaceId, id);
        ok('Lead unarchived');
      } else {
        await leadsApi.remove(workspaceId, id);
        ok('Lead archived');
      }
      await refreshAll();
    } catch (e) {
      err(e.message || 'Failed to update archive status');
    }
  }, [workspaceId, refreshAll, ok, err]);

  const openLeadClient = useCallback((lead) => {
    const clientId = String(lead?.clientId || '');
    if (!clientId) {
      err('Assign or create a client first');
      return;
    }
    navigate(ROUTES.clientDetail.replace(':clientId', clientId));
  }, [err, navigate]);

  const beginCreateClient = useCallback(() => {
    setClientForm(CLIENT_FORM_DEFAULTS);
    setOpenCreateClient(true);
  }, []);

  const closeCreateClient = useCallback(() => setOpenCreateClient(false), []);

  const saveClient = useCallback(async (event) => {
    event.preventDefault();
    const name = String(clientForm.name || '').trim();
    const company = String(clientForm.company || '').trim();
    if (!name || !company) {
      err('Name and company are required');
      return;
    }
    setCreateClientBusy(true);
    try {
      await createClient(toClientPayload(clientForm));
      await listClients();
      setOpenCreateClient(false);
      setClientForm(CLIENT_FORM_DEFAULTS);
      ok('Client created');
    } catch (e) {
      err(e.message || 'Failed to create client');
    } finally {
      setCreateClientBusy(false);
    }
  }, [clientForm, createClient, err, listClients, ok]);

  const toggleClientArchive = useCallback(async (client) => {
    const id = String(client?._id || '');
    if (!workspaceId || !id) return;
    try {
      if (client?.isArchived) {
        await clientsApi.restore(workspaceId, id);
        ok('Client unarchived');
      } else {
        await clientsApi.remove(workspaceId, id);
        ok('Client archived');
      }
      await listClients();
    } catch (e) {
      err(e.message || 'Failed to update archive status');
    }
  }, [workspaceId, listClients, ok, err]);

  const selectedClient = selected?.clientId ? clientLookup.get(String(selected.clientId)) : null;
  const selectedCustom = extractDetails(selected?.customFields);

  return (
    <main className="sv-leads-page relative flex min-h-screen flex-col">
      <div className="sv-leads-stack flex-1 space-y-5 overflow-y-auto p-6">
        <section className="sv-leads-toolbar flex flex-wrap items-center justify-between gap-3">
          <div className="sv-leads-tabs inline-flex rounded-lg border border-outline-variant/20 bg-surface-container p-1">
            <button type="button" onClick={() => setTab('list')} className={`sv-leads-tab-btn rounded-md px-4 py-2 text-sm font-semibold ${tab === 'list' ? 'is-active bg-primary text-white' : 'text-on-surface-variant'}`}>Leads</button>
            <button type="button" onClick={() => setTab('clients')} className={`sv-leads-tab-btn rounded-md px-4 py-2 text-sm font-semibold ${tab === 'clients' ? 'is-active bg-primary text-white' : 'text-on-surface-variant'}`}>Clients</button>
          </div>
          {tab === 'list' ? <button type="button" onClick={beginCreate} className="btn btn-primary sv-ctl-btn sv-leads-primary-btn rounded-lg px-4 py-2 text-sm font-semibold text-white">New Lead</button> : null}
          {tab === 'clients' ? <button type="button" onClick={beginCreateClient} className="btn btn-primary sv-ctl-btn sv-leads-primary-btn rounded-lg px-4 py-2 text-sm font-semibold text-white">New Client</button> : null}
        </section>

        {tab === 'list' ? (
          <>
            <section className="sv-leads-filters grid grid-cols-1 gap-2 md:grid-cols-[1fr_170px_170px_170px_170px_auto]">
              <input value={filters.search} onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))} placeholder="Search lead title..." className="form-control form-control-sm sv-ctl-input sv-leads-filter-input rounded-lg border border-outline-variant/20 bg-surface px-3 py-2 text-sm" />
              <select value={filters.status} onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value }))} className="form-select form-select-sm sv-ctl-select sv-leads-filter-select rounded-lg border border-outline-variant/20 bg-surface px-3 py-2 text-sm">
                <option value="all">All Status</option>
                {STAGES.map((stage) => <option key={stage.statusId} value={stage.statusId}>{stage.title}</option>)}
              </select>
              <select value={filters.priority} onChange={(e) => setFilters((p) => ({ ...p, priority: e.target.value }))} className="form-select form-select-sm sv-ctl-select sv-leads-filter-select rounded-lg border border-outline-variant/20 bg-surface px-3 py-2 text-sm">
                <option value="all">All Priority</option>
                {PRIORITY_VALUES.map((priority) => <option key={priority} value={priority}>{priority[0].toUpperCase() + priority.slice(1)}</option>)}
              </select>
              <select value={filters.source} onChange={(e) => setFilters((p) => ({ ...p, source: e.target.value }))} className="form-select form-select-sm sv-ctl-select sv-leads-filter-select rounded-lg border border-outline-variant/20 bg-surface px-3 py-2 text-sm">
                <option value="all">All Source</option>
                {SOURCE_VALUES.map((source) => <option key={source} value={source}>{source[0].toUpperCase() + source.slice(1)}</option>)}
              </select>
              <select value={filters.archiveScope} onChange={(e) => setFilters((p) => ({ ...p, archiveScope: e.target.value }))} className="form-select form-select-sm sv-ctl-select sv-leads-filter-select rounded-lg border border-outline-variant/20 bg-surface px-3 py-2 text-sm">
                <option value="all">All (Active)</option>
                <option value="archived">Archived Only</option>
              </select>
              <button type="button" onClick={resetFilters} className="btn btn-light sv-ctl-btn sv-leads-reset-btn rounded-lg border border-outline-variant/20 bg-surface px-3 py-2 text-sm">Reset</button>
            </section>

            {leadsError ? <div className="sv-leads-alert rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">{leadsError}</div> : null}

            <section className="sv-card sv-leads-table-card overflow-x-auto rounded-xl border border-outline-variant/10 bg-surface-container-lowest">
              <table className="sv-leads-table w-full min-w-[1150px] text-left">
                <thead>
                  <tr className="sv-leads-head-row border-b border-outline-variant/20 text-xs uppercase tracking-wider text-on-surface-variant">
                    <th className="px-3 py-3">Lead</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Move To</th>
                    <th className="px-3 py-3">Priority</th>
                    <th className="px-3 py-3">Source</th>
                    <th className="px-3 py-3">Value</th>
                    <th className="px-3 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {leadsLoading ? Array.from({ length: 5 }).map((_, idx) => (
                    <tr key={`loading-${idx}`} className="border-b border-outline-variant/10">
                      <td colSpan={7} className="px-3 py-4"><div className="h-8 animate-pulse rounded bg-surface-container-high" /></td>
                    </tr>
                  )) : null}
                  {!leadsLoading && pagedLeads.map((lead) => {
                    const id = leadId(lead);
                    const currentStatus = normStage(lead.statusId || lead.stage);
                    return (
                      <tr key={id} className="sv-leads-row border-b border-outline-variant/10">
                        <td className="px-3 py-3 text-sm font-semibold text-on-surface">
                          <div className="inline-flex items-center gap-2">
                            <span>{lead.title || '-'}</span>
                            {lead.isArchived ? <span className="sv-leads-archive-pill rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-700">Archived</span> : null}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-sm text-on-surface-variant">{stageTitle(currentStatus)}</td>
                        <td className="px-3 py-3">
                          <select value={currentStatus} onChange={(e) => openMove(lead, e.target.value)} className="form-select form-select-sm sv-ctl-select sv-leads-move-select rounded-lg border border-outline-variant/20 bg-surface px-2 py-1 text-sm">
                            {STAGES.map((stage) => <option key={`${id}-${stage.statusId}`} value={stage.statusId}>{stage.title}</option>)}
                          </select>
                        </td>
                        <td className="px-3 py-3 text-sm text-on-surface-variant">{nPriority(lead.priority)}</td>
                        <td className="px-3 py-3 text-sm text-on-surface-variant">{nSource(lead.source)}</td>
                        <td className="px-3 py-3 text-sm text-on-surface-variant">{fmtInr(lead.value)}</td>
                        <td className="px-3 py-3 text-right">
                          <div className="sv-leads-actions inline-flex items-center gap-1">
                            <button type="button" onClick={() => setSelectedLead(lead)} className="btn btn-light btn-sm sv-ctl-btn sv-leads-action-btn rounded-md bg-surface-container-high px-2 py-1 text-xs font-semibold text-on-surface">Details</button>
                            <button type="button" onClick={() => openEdit(lead)} className="btn btn-light btn-sm sv-ctl-btn sv-leads-action-btn rounded-md bg-surface-container-high px-2 py-1 text-xs font-semibold text-on-surface">Quick Edit</button>
                            <button type="button" onClick={() => openLeadClient(lead)} className="btn btn-light btn-sm sv-ctl-btn sv-leads-action-btn rounded-md bg-surface-container-high px-2 py-1 text-xs font-semibold text-on-surface">Client</button>
                            <button type="button" onClick={() => toggleLeadArchive(lead)} className={`btn btn-sm sv-ctl-btn sv-leads-action-btn sv-leads-archive-btn rounded-md px-2 py-1 text-xs font-semibold ${lead?.isArchived ? 'is-restore bg-green-100 text-green-700' : 'is-archive bg-error/10 text-error'}`}>
                              {lead?.isArchived ? 'Unarchive' : 'Archive'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {!leadsLoading && !filtered.length ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-10 text-center text-sm text-on-surface-variant">{(rows || []).length ? 'No leads match current filters.' : 'No leads yet. Create your first lead to get started.'}</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </section>
            <PaginationControls
              page={leadsPage}
              totalPages={leadsTotalPages}
              totalItems={filtered.length}
              pageSize={leadsPageSize}
              onPageChange={setLeadsPage}
              onPageSizeChange={setLeadsPageSize}
            />
          </>
        ) : (
          <>
            <section className="sv-leads-filters grid grid-cols-1 gap-2 md:grid-cols-[1fr_190px_auto]">
              <input value={clientFilters.search} onChange={(e) => setClientFilters((p) => ({ ...p, search: e.target.value }))} placeholder="Search client name, company, email..." className="form-control form-control-sm sv-ctl-input sv-leads-filter-input rounded-lg border border-outline-variant/20 bg-surface px-3 py-2 text-sm" />
              <select value={clientFilters.archiveScope} onChange={(e) => setClientFilters((p) => ({ ...p, archiveScope: e.target.value }))} className="form-select form-select-sm sv-ctl-select sv-leads-filter-select rounded-lg border border-outline-variant/20 bg-surface px-3 py-2 text-sm">
                <option value="all">All (Active)</option>
                <option value="archived">Archived Only</option>
                <option value="with-archived">With Archived</option>
              </select>
              <button type="button" onClick={resetClientFilters} className="btn btn-light sv-ctl-btn sv-leads-reset-btn rounded-lg border border-outline-variant/20 bg-surface px-3 py-2 text-sm">Reset</button>
            </section>
            <section className="sv-card sv-leads-table-card overflow-x-auto rounded-xl border border-outline-variant/10 bg-surface-container-lowest">
              <table className="sv-leads-table w-full min-w-[700px] text-left">
                <thead>
                  <tr className="sv-leads-head-row border-b border-outline-variant/20 text-xs uppercase tracking-wider text-on-surface-variant">
                    <th className="px-3 py-3">Client</th>
                    <th className="px-3 py-3">Company</th>
                    <th className="px-3 py-3">Email</th>
                    <th className="px-3 py-3">Phone</th>
                    <th className="px-3 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {clientsLoading ? Array.from({ length: 4 }).map((_, idx) => (
                    <tr key={`client-loading-${idx}`} className="border-b border-outline-variant/10">
                      <td colSpan={5} className="px-3 py-4"><div className="h-7 animate-pulse rounded bg-surface-container-high" /></td>
                    </tr>
                  )) : null}
                  {!clientsLoading && pagedClients.map((client) => (
                    <tr key={`client-row-${client._id}`} className="sv-leads-row border-b border-outline-variant/10">
                      <td className="px-3 py-3 text-sm font-semibold text-on-surface">
                        <div className="inline-flex items-center gap-2">
                          <span>{client.name || '-'}</span>
                          {client?.isArchived ? <span className="sv-leads-archive-pill rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-700">Archived</span> : null}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-sm text-on-surface-variant">{client.company || '-'}</td>
                      <td className="px-3 py-3 text-sm text-on-surface-variant">{client.email || '-'}</td>
                      <td className="px-3 py-3 text-sm text-on-surface-variant">{client.phone || '-'}</td>
                      <td className="px-3 py-3 text-right">
                        <div className="sv-leads-actions inline-flex items-center gap-1">
                          <button type="button" onClick={() => navigate(ROUTES.clientDetail.replace(':clientId', String(client._id)))} className="btn btn-light btn-sm sv-ctl-btn sv-leads-action-btn rounded-md bg-surface-container-high px-2 py-1 text-xs font-semibold text-on-surface">Open</button>
                          <button type="button" onClick={() => toggleClientArchive(client)} className={`btn btn-sm sv-ctl-btn sv-leads-action-btn sv-leads-archive-btn rounded-md px-2 py-1 text-xs font-semibold ${client?.isArchived ? 'is-restore bg-green-100 text-green-700' : 'is-archive bg-error/10 text-error'}`}>
                            {client?.isArchived ? 'Unarchive' : 'Archive'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!clientsLoading && !filteredClients.length ? (
                    <tr><td colSpan={5} className="px-3 py-10 text-center text-sm text-on-surface-variant">{(clients || []).length ? 'No clients match current filters.' : 'No clients found.'}</td></tr>
                  ) : null}
                </tbody>
              </table>
            </section>
            <PaginationControls
              page={clientsPage}
              totalPages={clientsTotalPages}
              totalItems={filteredClients.length}
              pageSize={clientsPageSize}
              onPageChange={setClientsPage}
              onPageSizeChange={setClientsPageSize}
            />
          </>
        )}
      </div>

      {selected ? (
        <aside className="sv-leads-drawer fixed inset-y-0 right-0 z-40 w-[360px] border-l border-outline-variant/20 bg-surface-container-lowest p-5 shadow-xl">
          <div className="sv-leads-drawer-head mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-3xl font-extrabold text-on-surface">{selected.title || 'Lead'}</h3>
              <p className="text-sm text-on-surface-variant">{stageTitle(selected.statusId || selected.stage)}</p>
            </div>
            <button type="button" aria-label="Close details" onClick={() => setSelectedLead(null)} className="sv-modal-close-btn" title="Close">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>

          <div className="sv-leads-drawer-sections space-y-3 rounded-xl border border-outline-variant/10 bg-surface-container p-4 text-sm">
            <section className="sv-leads-drawer-section">
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Deal</h4>
              <div className="grid grid-cols-[120px_1fr] gap-y-2">
                <span className="text-on-surface-variant">Value</span><span className="text-right text-on-surface">{fmtInr(selected.value)}</span>
                <span className="text-on-surface-variant">Priority</span><span className="text-right text-on-surface">{nPriority(selected.priority)}</span>
                <span className="text-on-surface-variant">Source</span><span className="text-right text-on-surface">{nSource(selected.source)}</span>
                <span className="text-on-surface-variant">Expected Close</span><span className="text-right text-on-surface">{fmtDate(selected.expectedCloseDate)}</span>
                <span className="text-on-surface-variant">Last Updated</span><span className="text-right text-on-surface">{fmtDate(selected.updatedAt || selected.createdAt)}</span>
              </div>
            </section>

            <section className="sv-leads-drawer-section">
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Identity</h4>
              <div className="grid grid-cols-[120px_1fr] gap-y-2">
                <span className="text-on-surface-variant">Lead Type</span><span className="text-right text-on-surface">{selectedCustom.leadType || '-'}</span>
                <span className="text-on-surface-variant">Contact Name</span><span className="text-right text-on-surface">{selectedCustom.contactName || '-'}</span>
                <span className="text-on-surface-variant">Company</span><span className="text-right text-on-surface">{selectedCustom.companyName || '-'}</span>
                <span className="text-on-surface-variant">Designation</span><span className="text-right text-on-surface">{selectedCustom.designation || '-'}</span>
                <span className="text-on-surface-variant">Assigned Client</span><span className="text-right text-on-surface">{selectedClient?.company || selectedClient?.name || '-'}</span>
              </div>
            </section>

            <section className="sv-leads-drawer-section">
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Contact</h4>
              <div className="grid grid-cols-[120px_1fr] gap-y-2">
                <span className="text-on-surface-variant">Email</span><span className="text-right text-on-surface">{selectedCustom.email || '-'}</span>
                <span className="text-on-surface-variant">Phone</span><span className="text-right text-on-surface">{selectedCustom.phone || '-'}</span>
                <span className="text-on-surface-variant">Alt Phone</span><span className="text-right text-on-surface">{selectedCustom.alternatePhone || '-'}</span>
                <span className="text-on-surface-variant">Website</span><span className="text-right text-on-surface">{selectedCustom.website || '-'}</span>
              </div>
            </section>

            <section className="sv-leads-drawer-section">
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-on-surface-variant">Business & Address</h4>
              <div className="grid grid-cols-[120px_1fr] gap-y-2">
                <span className="text-on-surface-variant">Tax ID</span><span className="text-right text-on-surface">{selectedCustom.taxId || '-'}</span>
                <span className="text-on-surface-variant">Address</span><span className="text-right text-on-surface">{selectedCustom.address || '-'}</span>
                <span className="text-on-surface-variant">City</span><span className="text-right text-on-surface">{selectedCustom.city || '-'}</span>
                <span className="text-on-surface-variant">State</span><span className="text-right text-on-surface">{selectedCustom.state || '-'}</span>
                <span className="text-on-surface-variant">Country</span><span className="text-right text-on-surface">{selectedCustom.country || '-'}</span>
                <span className="text-on-surface-variant">Pincode</span><span className="text-right text-on-surface">{selectedCustom.pincode || '-'}</span>
              </div>
            </section>
          </div>

          <div className="sv-leads-drawer-actions mt-4 flex items-center gap-2">
            <button type="button" onClick={() => openEdit(selected)} className="btn btn-primary sv-ctl-btn rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white">Quick Edit</button>
            <button type="button" onClick={() => setSelectedLead(null)} className="btn btn-light sv-ctl-btn rounded-lg border border-outline-variant/20 px-4 py-2 text-sm">Done</button>
          </div>
        </aside>
      ) : null}

      {openCreate ? (
        <div className="sv-modal-backdrop fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <form onSubmit={handleCreate} className="sv-card sv-modal-panel-lg sv-leads-modal max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-surface p-4">
            <div className="sv-leads-modal-head mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Create Lead</h3>
              <button type="button" aria-label="Close create lead" onClick={closeCreate} className="sv-modal-close-btn" title="Close">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input value={createForm.title} onChange={(e) => setCreateForm((p) => ({ ...p, title: e.target.value }))} placeholder="Lead Title *" className="rounded-lg border border-outline-variant/20 px-3 py-2 text-sm" required />
              <select value={createForm.statusId} onChange={(e) => setCreateForm((p) => ({ ...p, statusId: normStage(e.target.value) }))} className="rounded-lg border border-outline-variant/20 px-3 py-2 text-sm">{STAGES.map((s) => <option key={`create-stage-${s.statusId}`} value={s.statusId}>{s.title}</option>)}</select>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <input value={createForm.value} onChange={(e) => setCreateForm((p) => ({ ...p, value: e.target.value }))} type="number" min="0" placeholder="Value (INR)" className="rounded-lg border border-outline-variant/20 px-3 py-2 text-sm" />
              <input value={createForm.expectedCloseDate} onChange={(e) => setCreateForm((p) => ({ ...p, expectedCloseDate: e.target.value }))} type="date" className="rounded-lg border border-outline-variant/20 px-3 py-2 text-sm" />
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <select value={createForm.priority} onChange={(e) => setCreateForm((p) => ({ ...p, priority: nPriority(e.target.value) }))} className="rounded-lg border border-outline-variant/20 px-3 py-2 text-sm">{PRIORITY_VALUES.map((x) => <option key={`create-priority-${x}`} value={x}>{x[0].toUpperCase() + x.slice(1)}</option>)}</select>
              <select value={createForm.source} onChange={(e) => setCreateForm((p) => ({ ...p, source: nSource(e.target.value) }))} className="rounded-lg border border-outline-variant/20 px-3 py-2 text-sm">{SOURCE_VALUES.map((x) => <option key={`create-source-${x}`} value={x}>{x[0].toUpperCase() + x.slice(1)}</option>)}</select>
              <select value={createForm.clientId} onChange={(e) => handleCreateClientChange(e.target.value)} className="rounded-lg border border-outline-variant/20 px-3 py-2 text-sm">
                <option value="">No Client</option>
                {(clients || []).map((client) => <option key={`create-client-${client._id}`} value={String(client._id)}>{client.company || client.name || `Client ${client._id}`}</option>)}
              </select>
            </div>
            <div className="sv-leads-profile-block mt-3">
              <h4 className="text-sm font-semibold text-on-surface-variant">Profile Details</h4>
              <DetailFields form={createForm} setForm={setCreateForm} />
            </div>
            <div className="sv-leads-modal-actions mt-4 flex justify-end gap-2">
              <button type="button" onClick={closeCreate} className="rounded-lg border border-outline-variant/20 px-4 py-2 text-sm">Cancel</button>
              <button type="submit" disabled={createBusy} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{createBusy ? 'Saving...' : 'Create Lead'}</button>
            </div>
          </form>
        </div>
      ) : null}

      {editingLead ? (
        <div className="sv-modal-backdrop fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <form onSubmit={handleSaveEdit} className="sv-card sv-modal-panel-lg sv-leads-modal max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-surface p-4">
            <div className="sv-leads-modal-head mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Quick Edit Lead</h3>
              <button type="button" aria-label="Close edit lead" onClick={closeEdit} className="sv-modal-close-btn" title="Close">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input value={editForm.title} onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))} placeholder="Lead Title *" className="rounded-lg border border-outline-variant/20 px-3 py-2 text-sm" required />
              <input value={editForm.expectedCloseDate} onChange={(e) => setEditForm((p) => ({ ...p, expectedCloseDate: e.target.value }))} type="date" className="rounded-lg border border-outline-variant/20 px-3 py-2 text-sm" />
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <input value={editForm.value} onChange={(e) => setEditForm((p) => ({ ...p, value: e.target.value }))} type="number" min="0" placeholder="Value (INR)" className="rounded-lg border border-outline-variant/20 px-3 py-2 text-sm" />
              <select value={editForm.priority} onChange={(e) => setEditForm((p) => ({ ...p, priority: nPriority(e.target.value) }))} className="rounded-lg border border-outline-variant/20 px-3 py-2 text-sm">{PRIORITY_VALUES.map((x) => <option key={`edit-priority-${x}`} value={x}>{x[0].toUpperCase() + x.slice(1)}</option>)}</select>
              <select value={editForm.source} onChange={(e) => setEditForm((p) => ({ ...p, source: nSource(e.target.value) }))} className="rounded-lg border border-outline-variant/20 px-3 py-2 text-sm">{SOURCE_VALUES.map((x) => <option key={`edit-source-${x}`} value={x}>{x[0].toUpperCase() + x.slice(1)}</option>)}</select>
            </div>
            <div className="mt-2">
              <select value={editForm.clientId} onChange={(e) => handleEditClientChange(e.target.value)} className="w-full rounded-lg border border-outline-variant/20 px-3 py-2 text-sm">
                <option value="">No Client</option>
                {(clients || []).map((client) => <option key={`edit-client-${client._id}`} value={String(client._id)}>{client.company || client.name || `Client ${client._id}`}</option>)}
              </select>
            </div>
            <div className="sv-leads-profile-block mt-3">
              <h4 className="text-sm font-semibold text-on-surface-variant">Profile Details</h4>
              <DetailFields form={editForm} setForm={setEditForm} />
            </div>
            <div className="sv-leads-modal-actions mt-4 flex justify-end gap-2">
              <button type="button" onClick={closeEdit} className="rounded-lg border border-outline-variant/20 px-4 py-2 text-sm">Cancel</button>
              <button type="submit" disabled={editBusy} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{editBusy ? 'Saving...' : 'Save Changes'}</button>
            </div>
          </form>
        </div>
      ) : null}

      {openCreateClient ? (
        <div className="sv-modal-backdrop fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <form onSubmit={saveClient} className="sv-card sv-modal-panel-lg sv-leads-modal max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-surface p-4">
            <div className="sv-leads-modal-head mb-3 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Create Client</h3>
              <button type="button" aria-label="Close create client" onClick={closeCreateClient} className="sv-modal-close-btn" title="Close">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input value={clientForm.name} onChange={(e) => setClientForm((p) => ({ ...p, name: e.target.value }))} placeholder="Client Name *" className="rounded-lg border border-outline-variant/20 px-3 py-2 text-sm" required />
              <input value={clientForm.company} onChange={(e) => setClientForm((p) => ({ ...p, company: e.target.value }))} placeholder="Company *" className="rounded-lg border border-outline-variant/20 px-3 py-2 text-sm" required />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <input value={clientForm.email} onChange={(e) => setClientForm((p) => ({ ...p, email: e.target.value }))} placeholder="Email" className="rounded-lg border border-outline-variant/20 px-3 py-2 text-sm" />
              <input value={clientForm.phone} onChange={(e) => setClientForm((p) => ({ ...p, phone: e.target.value }))} placeholder="Phone" className="rounded-lg border border-outline-variant/20 px-3 py-2 text-sm" />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <input value={clientForm.contactName} onChange={(e) => setClientForm((p) => ({ ...p, contactName: e.target.value }))} placeholder="Contact Name" className="rounded-lg border border-outline-variant/20 px-3 py-2 text-sm" />
              <input value={clientForm.designation} onChange={(e) => setClientForm((p) => ({ ...p, designation: e.target.value }))} placeholder="Designation" className="rounded-lg border border-outline-variant/20 px-3 py-2 text-sm" />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <input value={clientForm.alternatePhone} onChange={(e) => setClientForm((p) => ({ ...p, alternatePhone: e.target.value }))} placeholder="Alternate Phone" className="rounded-lg border border-outline-variant/20 px-3 py-2 text-sm" />
              <input value={clientForm.website} onChange={(e) => setClientForm((p) => ({ ...p, website: e.target.value }))} placeholder="Website" className="rounded-lg border border-outline-variant/20 px-3 py-2 text-sm" />
            </div>
            <input value={clientForm.address} onChange={(e) => setClientForm((p) => ({ ...p, address: e.target.value }))} placeholder="Address" className="mt-2 w-full rounded-lg border border-outline-variant/20 px-3 py-2 text-sm" />
            <div className="mt-2 grid grid-cols-2 gap-2">
              <input value={clientForm.taxId} onChange={(e) => setClientForm((p) => ({ ...p, taxId: e.target.value }))} placeholder="GST/Tax ID" className="rounded-lg border border-outline-variant/20 px-3 py-2 text-sm" />
              <input value={clientForm.pincode} onChange={(e) => setClientForm((p) => ({ ...p, pincode: e.target.value }))} placeholder="Pincode" className="rounded-lg border border-outline-variant/20 px-3 py-2 text-sm" />
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <input value={clientForm.city} onChange={(e) => setClientForm((p) => ({ ...p, city: e.target.value }))} placeholder="City" className="rounded-lg border border-outline-variant/20 px-3 py-2 text-sm" />
              <input value={clientForm.state} onChange={(e) => setClientForm((p) => ({ ...p, state: e.target.value }))} placeholder="State" className="rounded-lg border border-outline-variant/20 px-3 py-2 text-sm" />
              <input value={clientForm.country} onChange={(e) => setClientForm((p) => ({ ...p, country: e.target.value }))} placeholder="Country" className="rounded-lg border border-outline-variant/20 px-3 py-2 text-sm" />
            </div>
            <div className="sv-leads-modal-actions mt-4 flex justify-end gap-2">
              <button type="button" onClick={closeCreateClient} className="rounded-lg border border-outline-variant/20 px-4 py-2 text-sm">Cancel</button>
              <button type="submit" disabled={createClientBusy} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{createClientBusy ? 'Saving...' : 'Create Client'}</button>
            </div>
          </form>
        </div>
      ) : null}

      {pendingMove ? (
        <div className="sv-modal-backdrop fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="sv-card sv-modal-panel sv-leads-move-modal w-full max-w-sm rounded-xl bg-surface p-5">
            <h3 className="text-base font-semibold">Confirm Move</h3>
            <p className="mt-2 text-sm text-on-surface-variant">Move lead <span className="font-semibold text-on-surface">{pendingMove.title}</span> from {stageTitle(pendingMove.fromStatusId)} to {stageTitle(pendingMove.toStatusId)}?</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={cancelMove} disabled={moveBusy} className="rounded-lg border border-outline-variant/20 px-4 py-2 text-sm">Cancel</button>
              <button type="button" onClick={confirmMove} disabled={moveBusy} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{moveBusy ? 'Moving...' : 'Confirm'}</button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className={`sv-leads-toast fixed bottom-5 right-5 z-[60] rounded-lg px-4 py-2 text-sm font-semibold text-white ${toast.tone === 'error' ? 'bg-error is-error' : 'bg-green-600 is-success'}`}>
          {toast.message}
        </div>
      ) : null}
    </main>
  );
}

export default LeadManagementPage;

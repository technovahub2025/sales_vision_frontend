import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Icon from '../../components/ui/Icon';
import DatePicker from '../../components/ui/DatePicker';
import SelectDropdown from '../../components/ui/SelectDropdown';
import ExportMenu from '../../components/ui/ExportMenu';
import { useLeads } from '../../hooks/useLeads';
import { useClients } from '../../hooks/useClients';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { clientsApi, leadsApi } from '../../api';
import { ROUTES } from '../../routes/routePaths';
import { useInfiniteScrollTrigger } from '../../hooks/useInfiniteScrollTrigger';
import { exportRows } from '../../lib/exportData';

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
const LEAD_TYPE_OPTIONS = [
  { value: 'company', label: 'Company' },
  { value: 'person', label: 'Person' },
];
const STAGE_OPTIONS = STAGES.map((stage) => ({ value: stage.statusId, label: stage.title }));
const PRIORITY_OPTIONS = PRIORITY_VALUES.map((priority) => ({ value: priority, label: priority[0].toUpperCase() + priority.slice(1) }));
const SOURCE_OPTIONS = SOURCE_VALUES.map((source) => ({ value: source, label: source[0].toUpperCase() + source.slice(1) }));
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
        <SelectDropdown
          value={form.leadType}
          onChange={(nextValue) => set('leadType', nextValue)}
          options={LEAD_TYPE_OPTIONS}
          triggerClassName="rounded-lg border border-outline-variant/20 px-3 py-2 text-sm"
        />
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
  const [isLeadFilterOpen, setIsLeadFilterOpen] = useState(false);
  const [isClientFilterOpen, setIsClientFilterOpen] = useState(false);
  const [openRowMenuId, setOpenRowMenuId] = useState('');
  const [openRowMenuPos, setOpenRowMenuPos] = useState({ top: 0, left: 0 });
  const [openRowMenuContext, setOpenRowMenuContext] = useState(null);
  const [createForm, setCreateForm] = useState(createDefaults);
  const [editForm, setEditForm] = useState(editDefaults);
  const [clientForm, setClientForm] = useState(CLIENT_FORM_DEFAULTS);
  const rowMenuRef = useRef(null);
  const leadsScrollRef = useRef(null);
  const clientsScrollRef = useRef(null);

  const {
    items: leads,
    loading: leadsLoading,
    loadingMore: leadsLoadingMore,
    hasMore: leadsHasMore,
    loadMore: loadMoreLeads,
    error: leadsError,
    refresh: refreshLeads,
    createItem,
    updateItem,
  } = useLeads();
  const {
    clients,
    loading: clientsLoading,
    loadingMore: clientsLoadingMore,
    hasMore: clientsHasMore,
    loadMore: loadMoreClients,
    createClient,
    list: listClients,
  } = useClients();

  const leadSentinelRef = useInfiniteScrollTrigger({
    rootRef: leadsScrollRef,
    onIntersect: () => {
      if (leadsHasMore && !leadsLoadingMore) void loadMoreLeads();
    },
    disabled: !leadsHasMore || leadsLoadingMore,
  });
  const clientSentinelRef = useInfiniteScrollTrigger({
    rootRef: clientsScrollRef,
    onIntersect: () => {
      if (clientsHasMore && !clientsLoadingMore) void loadMoreClients();
    },
    disabled: !clientsHasMore || clientsLoadingMore,
  });

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
  const clientOptions = useMemo(
    () => [
      { value: '', label: 'No Client' },
      ...(clients || []).map((client) => ({
        value: String(client._id),
        label: client.company || client.name || `Client ${client._id}`,
      })),
    ],
    [clients],
  );

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
  const leadInsights = useMemo(() => {
    const visible = filtered || [];
    const active = (rows || []).filter((lead) => !lead?.isArchived);
    const totalValue = visible.reduce((sum, lead) => sum + Number(lead?.value || 0), 0);
    const won = visible.filter((lead) => normStage(lead?.statusId || lead?.stage) === 'won').length;
    const hot = visible.filter((lead) => nPriority(lead?.priority) === 'hot').length;
    const archived = (rows || []).filter((lead) => lead?.isArchived).length;
    return {
      activeCount: active.length,
      visibleCount: visible.length,
      totalValue,
      won,
      hot,
      archived,
    };
  }, [filtered, rows]);
  const clientInsights = useMemo(() => {
    const visible = filteredClients || [];
    const companies = new Set(visible.map((client) => String(client?.company || '').trim()).filter(Boolean)).size;
    const withPhone = visible.filter((client) => String(client?.phone || '').trim()).length;
    const archived = (clients || []).filter((client) => client?.isArchived).length;
    return {
      visibleCount: visible.length,
      totalCount: (clients || []).filter((client) => !client?.isArchived).length,
      companies,
      withPhone,
      archived,
    };
  }, [clients, filteredClients]);

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
    leadsScrollRef.current?.scrollTo({ top: 0 });
  }, [filters.search, filters.status, filters.priority, filters.source, filters.archiveScope]);

  useEffect(() => {
    clientsScrollRef.current?.scrollTo({ top: 0 });
  }, [clientFilters.search, clientFilters.archiveScope]);

  const closeRowMenu = useCallback(() => {
    setOpenRowMenuId('');
    setOpenRowMenuContext(null);
  }, []);

  const openRowMenu = useCallback((event, type, row) => {
    event.stopPropagation();
    const id = `${type}-${String(row?._id || row?.id || '')}`;
    if (openRowMenuId === id) {
      closeRowMenu();
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const menuWidth = 220;
    const menuHeight = type === 'lead' ? 190 : 130;
    const placeAbove = window.innerHeight - rect.bottom < menuHeight && rect.top > menuHeight + 12;

    const top = placeAbove
      ? Math.max(8, rect.top - menuHeight - 6)
      : Math.min(window.innerHeight - menuHeight - 8, rect.bottom + 6);
    const left = Math.min(window.innerWidth - menuWidth - 8, Math.max(8, rect.right - menuWidth));

    setOpenRowMenuPos({ top, left });
    setOpenRowMenuContext({ type, row });
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
  const isLeadTab = tab === 'list';
  const heroTitle = isLeadTab ? 'Lead Pipeline' : 'Client Directory';
  const heroSubtitle = isLeadTab
    ? 'Track opportunity value, stage movement, and priority from one focused workspace.'
    : 'Manage client records, contact details, and archive state without leaving the list.';
  const statCards = isLeadTab
    ? [
        { label: 'Visible Leads', value: leadInsights.visibleCount, hint: `${leadInsights.activeCount} active total`, tone: 'blue' },
        { label: 'Pipeline Value', value: fmtInr(leadInsights.totalValue), hint: 'Filtered value', tone: 'green' },
        { label: 'Won Deals', value: leadInsights.won, hint: 'Current view', tone: 'amber' },
        { label: 'Hot Leads', value: leadInsights.hot, hint: `${leadInsights.archived} archived`, tone: 'red' },
      ]
    : [
        { label: 'Visible Clients', value: clientInsights.visibleCount, hint: `${clientInsights.totalCount} active total`, tone: 'blue' },
        { label: 'Companies', value: clientInsights.companies, hint: 'Unique names', tone: 'green' },
        { label: 'Phone Contacts', value: clientInsights.withPhone, hint: 'Ready to call', tone: 'amber' },
        { label: 'Archived', value: clientInsights.archived, hint: 'Hidden by default', tone: 'red' },
      ];
  const handleExportCurrent = useCallback((format) => {
    if (isLeadTab) {
      exportRows({
        rows: filtered,
        format,
        filename: `leads-${new Date().toISOString().slice(0, 10)}`,
        title: 'Leads Export',
        columns: [
          { header: 'Lead', value: (row) => row.title || '-' },
          { header: 'Status', value: (row) => stageTitle(row.statusId || row.stage) },
          { header: 'Priority', value: (row) => nPriority(row.priority) },
          { header: 'Source', value: (row) => nSource(row.source) },
          { header: 'Value', value: (row) => Number(row.value || 0) },
          { header: 'Archived', value: (row) => (row.isArchived ? 'Yes' : 'No') },
        ],
      });
      return;
    }
    exportRows({
      rows: filteredClients,
      format,
      filename: `clients-${new Date().toISOString().slice(0, 10)}`,
      title: 'Clients Export',
      columns: [
        { header: 'Client', value: (row) => row.name || '-' },
        { header: 'Company', value: (row) => row.company || '-' },
        { header: 'Email', value: (row) => row.email || '-' },
        { header: 'Phone', value: (row) => row.phone || '-' },
        { header: 'Archived', value: (row) => (row.isArchived ? 'Yes' : 'No') },
      ],
    });
  }, [filtered, filteredClients, isLeadTab]);

  return (
    <main className="sv-leads-page relative flex min-h-screen flex-col">
      <div className="sv-leads-stack flex-1 space-y-5 overflow-y-auto p-6">
        <section className="sv-card sv-leads-hero">
          <div className="sv-leads-hero-main">
            <div className="sv-leads-eyebrow">
              <Icon name={isLeadTab ? 'monitoring' : 'groups'} className="text-base" />
              <span>{isLeadTab ? 'Sales workspace' : 'Customer workspace'}</span>
            </div>
            <h1>{heroTitle}</h1>
            <p>{heroSubtitle}</p>
          </div>
          <div className="sv-leads-hero-side">
            <div className="sv-leads-tabs inline-flex rounded-lg border border-outline-variant/20 bg-surface-container p-1">
              <button type="button" onClick={() => setTab('list')} className={`sv-leads-tab-btn rounded-md px-4 py-2 text-sm font-semibold ${tab === 'list' ? 'is-active bg-primary text-white' : 'text-on-surface-variant'}`}>Leads</button>
              <button type="button" onClick={() => setTab('clients')} className={`sv-leads-tab-btn rounded-md px-4 py-2 text-sm font-semibold ${tab === 'clients' ? 'is-active bg-primary text-white' : 'text-on-surface-variant'}`}>Clients</button>
            </div>
            <ExportMenu onExport={handleExportCurrent} label="Export" disabled={isLeadTab ? !filtered.length : !filteredClients.length} />
            {isLeadTab ? <button type="button" onClick={beginCreate} className="btn btn-primary sv-ctl-btn sv-leads-primary-btn rounded-lg px-4 py-2 text-sm font-semibold text-white"><Icon name="add" className="text-base" />New Lead</button> : null}
            {!isLeadTab ? <button type="button" onClick={beginCreateClient} className="btn btn-primary sv-ctl-btn sv-leads-primary-btn rounded-lg px-4 py-2 text-sm font-semibold text-white"><Icon name="person_add" className="text-base" />New Client</button> : null}
          </div>
        </section>

        <section className="sv-leads-insights" aria-label={`${heroTitle} metrics`}>
          {statCards.map((card) => (
            <article key={card.label} className={`sv-leads-insight-card is-${card.tone}`}>
              <span>{card.label}</span>
              <strong>{card.value}</strong>
              <small>{card.hint}</small>
            </article>
          ))}
        </section>

        {isLeadTab ? (
          <>
            <section className="sv-leads-filter-bar sv-card grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto]">
              <input value={filters.search} onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value }))} placeholder="Search lead title..." className="form-control form-control-sm sv-ctl-input sv-leads-filter-input rounded-lg border border-outline-variant/20 bg-surface px-3 py-2 text-sm" />
              <button
                type="button"
                onClick={() => setIsLeadFilterOpen((prev) => !prev)}
                className={`btn sv-ctl-btn sv-leads-filter-toggle ${isLeadFilterOpen ? 'is-active' : ''}`}
                aria-expanded={isLeadFilterOpen}
              >
                <Icon name="filter_list" className="text-base" />
                <span>Filters</span>
              </button>
            </section>
            {isLeadFilterOpen ? (
              <section className="sv-leads-filters sv-leads-filters-panel grid grid-cols-1 gap-2 md:grid-cols-[170px_170px_170px_170px_auto]">
                <SelectDropdown value={filters.status} onChange={(nextValue) => setFilters((p) => ({ ...p, status: nextValue }))} options={[{ value: 'all', label: 'All Status' }, ...STAGE_OPTIONS]} triggerClassName="sv-leads-filter-select rounded-lg border border-outline-variant/20 bg-surface px-3 py-2 text-sm" />
                <SelectDropdown value={filters.priority} onChange={(nextValue) => setFilters((p) => ({ ...p, priority: nextValue }))} options={[{ value: 'all', label: 'All Priority' }, ...PRIORITY_OPTIONS]} triggerClassName="sv-leads-filter-select rounded-lg border border-outline-variant/20 bg-surface px-3 py-2 text-sm" />
                <SelectDropdown value={filters.source} onChange={(nextValue) => setFilters((p) => ({ ...p, source: nextValue }))} options={[{ value: 'all', label: 'All Source' }, ...SOURCE_OPTIONS]} triggerClassName="sv-leads-filter-select rounded-lg border border-outline-variant/20 bg-surface px-3 py-2 text-sm" />
                <SelectDropdown value={filters.archiveScope} onChange={(nextValue) => setFilters((p) => ({ ...p, archiveScope: nextValue }))} options={[{ value: 'all', label: 'All (Active)' }, { value: 'archived', label: 'Archived Only' }]} triggerClassName="sv-leads-filter-select rounded-lg border border-outline-variant/20 bg-surface px-3 py-2 text-sm" />
                <button type="button" onClick={resetFilters} className="btn btn-light sv-ctl-btn sv-leads-reset-btn rounded-lg border border-outline-variant/20 bg-surface px-3 py-2 text-sm">Reset</button>
              </section>
            ) : null}

            {leadsError ? <div className="sv-leads-alert rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">{leadsError}</div> : null}

            <section className="sv-card sv-leads-table-card sv-list-scroll rounded-xl border border-outline-variant/10 bg-surface-container-lowest" ref={leadsScrollRef}>
              <table className="sv-leads-table w-full min-w-[1150px] text-left">
                <thead>
                  <tr className="sv-leads-head-row border-b border-outline-variant/20 text-xs uppercase tracking-wider text-on-surface-variant">
                    <th className="px-3 py-3">Lead</th>
                    <th className="px-3 py-3">Status</th>
                    <th className="px-3 py-3">Move To</th>
                    <th className="px-3 py-3">Priority</th>
                    <th className="px-3 py-3">Source</th>
                    <th className="px-3 py-3">Value</th>
                    <th className="px-3 py-3 sv-row-action-heading sv-leads-actions-cell">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {leadsLoading ? Array.from({ length: 5 }).map((_, idx) => (
                    <tr key={`loading-${idx}`} className="border-b border-outline-variant/10">
                      <td colSpan={7} className="px-3 py-4"><div className="h-8 animate-pulse rounded bg-surface-container-high" /></td>
                    </tr>
                  )) : null}
                  {!leadsLoading && filtered.map((lead) => {
                    const id = leadId(lead);
                    const currentStatus = normStage(lead.statusId || lead.stage);
                    return (
                      <tr key={id} className="sv-leads-row border-b border-outline-variant/10">
                        <td className="px-3 py-3 text-sm font-semibold text-on-surface">
                          <div className="inline-flex items-center gap-2">
                            <button type="button" className="sv-name-open-btn" onClick={() => setSelectedLead(lead)}>{lead.title || '-'}</button>
                            {lead.isArchived ? <span className="sv-leads-archive-pill rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-700">Archived</span> : null}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-sm text-on-surface-variant">{stageTitle(currentStatus)}</td>
                        <td className="px-3 py-3">
                          <SelectDropdown value={currentStatus} onChange={(nextValue) => openMove(lead, nextValue)} options={STAGE_OPTIONS} triggerClassName="sv-leads-move-select rounded-lg border border-outline-variant/20 bg-surface px-2 py-1 text-sm" />
                        </td>
                        <td className="px-3 py-3 text-sm text-on-surface-variant">{nPriority(lead.priority)}</td>
                        <td className="px-3 py-3 text-sm text-on-surface-variant">{nSource(lead.source)}</td>
                        <td className="px-3 py-3 text-sm text-on-surface-variant">{fmtInr(lead.value)}</td>
                        <td className="px-3 py-3 sv-row-action-cell sv-leads-actions-cell">
                          <div className="sv-row-menu-container">
                            <button
                              type="button"
                              className="sv-row-menu-btn"
                              data-row-menu-trigger="true"
                              aria-label="Open actions"
                              aria-expanded={openRowMenuId === `lead-${id}`}
                              onClick={(event) => openRowMenu(event, 'lead', lead)}
                            >
                              <Icon name="more_vert" className="text-lg" />
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
                  {!leadsLoading && filtered.length ? (
                    <tr>
                      <td colSpan={7} className="sv-list-sentinel-cell">
                        <span ref={leadSentinelRef} className="sv-list-sentinel" />
                        {leadsLoadingMore ? 'Loading more leads...' : leadsHasMore ? 'Scroll for more' : 'End of list'}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </section>
          </>
        ) : (
          <>
            <section className="sv-leads-filter-bar sv-card grid grid-cols-1 gap-2 md:grid-cols-[1fr_auto]">
              <input value={clientFilters.search} onChange={(e) => setClientFilters((p) => ({ ...p, search: e.target.value }))} placeholder="Search client name, company, email..." className="form-control form-control-sm sv-ctl-input sv-leads-filter-input rounded-lg border border-outline-variant/20 bg-surface px-3 py-2 text-sm" />
              <button
                type="button"
                onClick={() => setIsClientFilterOpen((prev) => !prev)}
                className={`btn sv-ctl-btn sv-leads-filter-toggle ${isClientFilterOpen ? 'is-active' : ''}`}
                aria-expanded={isClientFilterOpen}
              >
                <Icon name="filter_list" className="text-base" />
                <span>Filters</span>
              </button>
            </section>
            {isClientFilterOpen ? (
              <section className="sv-leads-filters sv-leads-filters-panel grid grid-cols-1 gap-2 md:grid-cols-[190px_auto]">
                <SelectDropdown
                  value={clientFilters.archiveScope}
                  onChange={(nextValue) => setClientFilters((p) => ({ ...p, archiveScope: nextValue }))}
                  options={[
                    { value: 'all', label: 'All (Active)' },
                    { value: 'archived', label: 'Archived Only' },
                    { value: 'with-archived', label: 'With Archived' },
                  ]}
                  triggerClassName="sv-leads-filter-select rounded-lg border border-outline-variant/20 bg-surface px-3 py-2 text-sm"
                />
                <button type="button" onClick={resetClientFilters} className="btn btn-light sv-ctl-btn sv-leads-reset-btn rounded-lg border border-outline-variant/20 bg-surface px-3 py-2 text-sm">Reset</button>
              </section>
            ) : null}
            <section className="sv-card sv-leads-table-card sv-list-scroll rounded-xl border border-outline-variant/10 bg-surface-container-lowest" ref={clientsScrollRef}>
              <table className="sv-leads-table w-full min-w-[700px] text-left">
                <thead>
                  <tr className="sv-leads-head-row border-b border-outline-variant/20 text-xs uppercase tracking-wider text-on-surface-variant">
                    <th className="px-3 py-3">Client</th>
                    <th className="px-3 py-3">Company</th>
                    <th className="px-3 py-3">Email</th>
                    <th className="px-3 py-3">Phone</th>
                    <th className="px-3 py-3 sv-row-action-heading sv-leads-actions-cell">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {clientsLoading ? Array.from({ length: 4 }).map((_, idx) => (
                    <tr key={`client-loading-${idx}`} className="border-b border-outline-variant/10">
                      <td colSpan={5} className="px-3 py-4"><div className="h-7 animate-pulse rounded bg-surface-container-high" /></td>
                    </tr>
                  )) : null}
                  {!clientsLoading && filteredClients.map((client) => (
                    <tr key={`client-row-${client._id}`} className="sv-leads-row border-b border-outline-variant/10">
                      <td className="px-3 py-3 text-sm font-semibold text-on-surface">
                        <div className="inline-flex items-center gap-2">
                          <button type="button" className="sv-name-open-btn" onClick={() => navigate(ROUTES.clientDetail.replace(':clientId', String(client._id)))}>{client.name || '-'}</button>
                          {client?.isArchived ? <span className="sv-leads-archive-pill rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-700">Archived</span> : null}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-sm text-on-surface-variant">{client.company || '-'}</td>
                      <td className="px-3 py-3 text-sm text-on-surface-variant">{client.email || '-'}</td>
                      <td className="px-3 py-3 text-sm text-on-surface-variant">{client.phone || '-'}</td>
                      <td className="px-3 py-3 sv-row-action-cell sv-leads-actions-cell">
                        <div className="sv-row-menu-container">
                          <button
                            type="button"
                            className="sv-row-menu-btn"
                            data-row-menu-trigger="true"
                            aria-label="Open actions"
                            aria-expanded={openRowMenuId === `client-${String(client?._id || '')}`}
                            onClick={(event) => openRowMenu(event, 'client', client)}
                          >
                            <Icon name="more_vert" className="text-lg" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!clientsLoading && !filteredClients.length ? (
                    <tr><td colSpan={5} className="px-3 py-10 text-center text-sm text-on-surface-variant">{(clients || []).length ? 'No clients match current filters.' : 'No clients found.'}</td></tr>
                  ) : null}
                  {!clientsLoading && filteredClients.length ? (
                    <tr>
                      <td colSpan={5} className="sv-list-sentinel-cell">
                        <span ref={clientSentinelRef} className="sv-list-sentinel" />
                        {clientsLoadingMore ? 'Loading more clients...' : clientsHasMore ? 'Scroll for more' : 'End of list'}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </section>
          </>
        )}
      </div>

      {openRowMenuId && openRowMenuContext?.type === 'lead' ? (
        <div
          ref={rowMenuRef}
          className="sv-row-menu-popover sv-row-menu-popover-fixed"
          style={{ top: `${openRowMenuPos.top}px`, left: `${openRowMenuPos.left}px` }}
        >
          <button
            type="button"
            className="sv-row-menu-item"
            onClick={() => {
              const row = openRowMenuContext.row;
              closeRowMenu();
              setSelectedLead(row);
            }}
          >
            <Icon name="info" className="sv-icon-btn-icon" />
            <span>Details</span>
          </button>
          <button
            type="button"
            className="sv-row-menu-item"
            onClick={() => {
              const row = openRowMenuContext.row;
              closeRowMenu();
              openEdit(row);
            }}
          >
            <Icon name="edit" className="sv-icon-btn-icon" />
            <span>Quick Edit</span>
          </button>
          <button
            type="button"
            className="sv-row-menu-item"
            onClick={() => {
              const row = openRowMenuContext.row;
              closeRowMenu();
              openLeadClient(row);
            }}
          >
            <Icon name="contacts" className="sv-icon-btn-icon" />
            <span>Client</span>
          </button>
          <button
            type="button"
            className="sv-row-menu-item is-danger"
            onClick={() => {
              const row = openRowMenuContext.row;
              closeRowMenu();
              toggleLeadArchive(row);
            }}
          >
            <Icon name={openRowMenuContext.row?.isArchived ? 'unarchive' : 'archive'} className="sv-icon-btn-icon" />
            <span>{openRowMenuContext.row?.isArchived ? 'Unarchive' : 'Archive'}</span>
          </button>
        </div>
      ) : null}

      {openRowMenuId && openRowMenuContext?.type === 'client' ? (
        <div
          ref={rowMenuRef}
          className="sv-row-menu-popover sv-row-menu-popover-fixed"
          style={{ top: `${openRowMenuPos.top}px`, left: `${openRowMenuPos.left}px` }}
        >
          <button
            type="button"
            className="sv-row-menu-item"
            onClick={() => {
              const row = openRowMenuContext.row;
              closeRowMenu();
              navigate(ROUTES.clientDetail.replace(':clientId', String(row._id)));
            }}
          >
            <Icon name="open_in_new" className="sv-icon-btn-icon" />
            <span>Open</span>
          </button>
          <button
            type="button"
            className="sv-row-menu-item is-danger"
            onClick={() => {
              const row = openRowMenuContext.row;
              closeRowMenu();
              toggleClientArchive(row);
            }}
          >
            <Icon name={openRowMenuContext.row?.isArchived ? 'unarchive' : 'archive'} className="sv-icon-btn-icon" />
            <span>{openRowMenuContext.row?.isArchived ? 'Unarchive' : 'Archive'}</span>
          </button>
        </div>
      ) : null}

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
              <SelectDropdown value={createForm.statusId} onChange={(nextValue) => setCreateForm((p) => ({ ...p, statusId: normStage(nextValue) }))} options={STAGE_OPTIONS} triggerClassName="rounded-lg border border-outline-variant/20 px-3 py-2 text-sm" />
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <input value={createForm.value} onChange={(e) => setCreateForm((p) => ({ ...p, value: e.target.value }))} type="number" min="0" placeholder="Value (INR)" className="rounded-lg border border-outline-variant/20 px-3 py-2 text-sm" />
              <DatePicker value={createForm.expectedCloseDate} onChange={(nextValue) => setCreateForm((p) => ({ ...p, expectedCloseDate: nextValue }))} className="w-full" triggerClassName="rounded-lg border border-outline-variant/20 px-3 py-2 text-sm" placeholder="Expected close" />
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <SelectDropdown value={createForm.priority} onChange={(nextValue) => setCreateForm((p) => ({ ...p, priority: nPriority(nextValue) }))} options={PRIORITY_OPTIONS} triggerClassName="rounded-lg border border-outline-variant/20 px-3 py-2 text-sm" />
              <SelectDropdown value={createForm.source} onChange={(nextValue) => setCreateForm((p) => ({ ...p, source: nSource(nextValue) }))} options={SOURCE_OPTIONS} triggerClassName="rounded-lg border border-outline-variant/20 px-3 py-2 text-sm" />
              <SelectDropdown value={createForm.clientId} onChange={handleCreateClientChange} options={clientOptions} triggerClassName="rounded-lg border border-outline-variant/20 px-3 py-2 text-sm" />
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
              <DatePicker value={editForm.expectedCloseDate} onChange={(nextValue) => setEditForm((p) => ({ ...p, expectedCloseDate: nextValue }))} className="w-full" triggerClassName="rounded-lg border border-outline-variant/20 px-3 py-2 text-sm" placeholder="Expected close" />
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <input value={editForm.value} onChange={(e) => setEditForm((p) => ({ ...p, value: e.target.value }))} type="number" min="0" placeholder="Value (INR)" className="rounded-lg border border-outline-variant/20 px-3 py-2 text-sm" />
              <SelectDropdown value={editForm.priority} onChange={(nextValue) => setEditForm((p) => ({ ...p, priority: nPriority(nextValue) }))} options={PRIORITY_OPTIONS} triggerClassName="rounded-lg border border-outline-variant/20 px-3 py-2 text-sm" />
              <SelectDropdown value={editForm.source} onChange={(nextValue) => setEditForm((p) => ({ ...p, source: nSource(nextValue) }))} options={SOURCE_OPTIONS} triggerClassName="rounded-lg border border-outline-variant/20 px-3 py-2 text-sm" />
            </div>
            <div className="mt-2">
              <SelectDropdown value={editForm.clientId} onChange={handleEditClientChange} options={clientOptions} triggerClassName="w-full rounded-lg border border-outline-variant/20 px-3 py-2 text-sm" />
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

import { useCallback, useMemo, useState, useEffect, useRef } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { ROUTES } from '../../routes/routePaths';
import { useEmployees } from '../../hooks/useEmployees';
import { useContacts } from '../../hooks/useContacts';
import { useTeams } from '../../hooks/useTeams';
import SelectDropdown from '../../components/ui/SelectDropdown';
import ExportMenu from '../../components/ui/ExportMenu';
import Icon from '../../components/ui/Icon';
import { useInfiniteScrollTrigger } from '../../hooks/useInfiniteScrollTrigger';
import { compareByRecencyAsc, compareByRecencyDesc } from '../../lib/listSort';
import { exportRows } from '../../lib/exportData';

const EMPTY_EMPLOYEE = {
  name: '',
  email: '',
  role: '',
  department: '',
  designation: '',
  phone: '',
  team: '',
  employeeCode: '',
  status: 'active',
  availabilityStatus: 'available',
  hoursPerWeek: 40,
  velocity: 0,
  managerId: '',
  managerName: '',
  contactId: '',
};

function normalizeEmployeeForm(employee) {
  return {
    name: employee?.name || '',
    email: employee?.email || '',
    role: employee?.role || '',
    department: employee?.department || '',
    designation: employee?.designation || '',
    phone: employee?.phone || '',
    team: employee?.team || '',
    employeeCode: employee?.employeeCode || '',
    status: employee?.status || 'active',
    availabilityStatus: employee?.availability?.status || 'available',
    hoursPerWeek: Number(employee?.capacity?.hoursPerWeek || 40),
    velocity: Number(employee?.velocity || 0),
    managerId: employee?.manager?.id || '',
    managerName: employee?.manager?.name || '',
    contactId: employee?.contactId || '',
  };
}

function buildEmployeePayload(form) {
  return {
    name: String(form.name || '').trim(),
    email: String(form.email || '').trim().toLowerCase(),
    role: String(form.role || '').trim(),
    department: String(form.department || '').trim(),
    designation: String(form.designation || '').trim(),
    phone: String(form.phone || '').trim(),
    team: String(form.team || '').trim(),
    employeeCode: String(form.employeeCode || '').trim(),
    status: form.status || 'active',
    availability: { status: form.availabilityStatus || 'available' },
    capacity: { hoursPerWeek: Math.max(1, Number(form.hoursPerWeek || 40)) },
    velocity: Math.max(0, Number(form.velocity || 0)),
    manager: form.managerId ? { id: form.managerId, name: form.managerName || '' } : { id: null, name: '' },
    contactId: form.contactId || null,
  };
}

function EmployeeFormModal({
  open,
  mode,
  form,
  onChange,
  onClose,
  onSubmit,
  saving,
  employees,
  contacts,
  teams,
  editingId,
  onCreateTeam,
}) {
  if (!open) return null;

  const managerOptions = employees.filter((item) => String(item._id) !== String(editingId || ''));

  return (
    <div className="sv-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="sv-card sv-employees-modal">
        <div className="sv-employees-modal-head">
          <h2 className="sv-employees-modal-title">{mode === 'edit' ? 'Edit Employee' : 'Create Employee'}</h2>
          <button
            type="button"
            onClick={onClose}
            className="sv-modal-close-btn"
            aria-label="Close"
          >
            <Icon name="close" className="text-lg" />
          </button>
        </div>

        <form
          onSubmit={onSubmit}
          className="sv-employees-modal-form"
        >
          <input className="sv-ctl-input sv-employees-field" placeholder="Full name *" value={form.name} onChange={(e) => onChange('name', e.target.value)} required />
          <input className="sv-ctl-input sv-employees-field" placeholder="Email" value={form.email} onChange={(e) => onChange('email', e.target.value)} />
          <input className="sv-ctl-input sv-employees-field" placeholder="Role" value={form.role} onChange={(e) => onChange('role', e.target.value)} />
          <input className="sv-ctl-input sv-employees-field" placeholder="Department" value={form.department} onChange={(e) => onChange('department', e.target.value)} />
          <input className="sv-ctl-input sv-employees-field" placeholder="Designation" value={form.designation} onChange={(e) => onChange('designation', e.target.value)} />
          <input className="sv-ctl-input sv-employees-field" placeholder="Phone" value={form.phone} onChange={(e) => onChange('phone', e.target.value)} />

          <div className="sv-employees-team-row">
            <SelectDropdown
              value={form.team}
              onChange={(nextValue) => onChange('team', nextValue)}
              options={[
                { value: '', label: 'Select team' },
                ...teams.map((team) => ({ value: team.name || '', label: team.name || 'Unnamed team' })),
              ]}
              triggerClassName="sv-employees-field"
            />
            <button
              type="button"
              onClick={onCreateTeam}
              className="sv-ctl-btn btn-light sv-icon-btn"
            >
              <Icon name="group_add" className="sv-icon-btn-icon" />
              <span>New Team</span>
            </button>
          </div>

          <input className="sv-ctl-input sv-employees-field" placeholder="Employee Code" value={form.employeeCode} onChange={(e) => onChange('employeeCode', e.target.value)} />

          <SelectDropdown
            value={form.status}
            onChange={(nextValue) => onChange('status', nextValue)}
            options={[
              { value: 'active', label: 'Active' },
              { value: 'inactive', label: 'Inactive' },
              { value: 'archived', label: 'Archived' },
            ]}
            className="sv-employees-field"
          />

          <SelectDropdown
            value={form.availabilityStatus}
            onChange={(nextValue) => onChange('availabilityStatus', nextValue)}
            options={[
              { value: 'available', label: 'Available' },
              { value: 'busy', label: 'Busy' },
              { value: 'ooo', label: 'Out Of Office' },
              { value: 'leave', label: 'On Leave' },
            ]}
            className="sv-employees-field"
          />

          <input type="number" min="1" className="sv-ctl-input sv-employees-field" placeholder="Hours / week" value={form.hoursPerWeek} onChange={(e) => onChange('hoursPerWeek', e.target.value)} />
          <input type="number" min="0" className="sv-ctl-input sv-employees-field" placeholder="Velocity" value={form.velocity} onChange={(e) => onChange('velocity', e.target.value)} />

          <SelectDropdown
            value={form.managerId}
            onChange={(nextValue) => {
              const manager = managerOptions.find((item) => String(item._id) === String(nextValue));
              onChange('managerId', nextValue);
              onChange('managerName', manager?.name || '');
            }}
            options={[
              { value: '', label: 'No manager' },
              ...managerOptions.map((employee) => ({ value: employee._id, label: employee.name || 'Unnamed' })),
            ]}
            className="sv-employees-field"
          />

          <SelectDropdown
            value={form.contactId}
            onChange={(nextValue) => onChange('contactId', nextValue)}
            options={[
              { value: '', label: 'No linked contact' },
              ...contacts.map((contact) => ({
                value: contact._id,
                label: `${contact.name || 'Unnamed'}${contact.email ? ` (${contact.email})` : ''}`,
              })),
            ]}
            className="sv-employees-field"
          />

          <div className="sv-employees-modal-actions">
            <button type="button" onClick={onClose} className="sv-ctl-btn btn-light sv-icon-btn">
              <Icon name="close" className="sv-icon-btn-icon" />
              <span>Cancel</span>
            </button>
            <button type="submit" disabled={saving} className="sv-ctl-btn btn-primary sv-icon-btn">
              <Icon name={mode === 'edit' ? 'save' : 'person_add'} className="sv-icon-btn-icon" />
              <span>{saving ? 'Saving...' : mode === 'edit' ? 'Save Changes' : 'Create Employee'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EmployeeManagementPage() {
  const navigate = useNavigate();
  const { items: employees, loading, loadingMore, hasMore, loadMore, error, createItem, updateItem, removeItem } = useEmployees();
  const { items: contacts } = useContacts();
  const { teams, createTeam } = useTeams();

  const [search, setSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [teamFilter, setTeamFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [editingId, setEditingId] = useState('');
  const [employeeForm, setEmployeeForm] = useState(EMPTY_EMPLOYEE);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [toast, setToast] = useState(null);
  const [openRowMenuId, setOpenRowMenuId] = useState('');
  const [openRowMenuPos, setOpenRowMenuPos] = useState({ top: 0, left: 0 });
  const [openRowMenuContext, setOpenRowMenuContext] = useState(null);
  const rowMenuRef = useRef(null);
  const listScrollRef = useRef(null);
  const loadMoreEmployees = useCallback(() => {
    if (!hasMore || loadingMore) return;
    void loadMore();
  }, [hasMore, loadingMore, loadMore]);
  const loadMoreRef = useInfiniteScrollTrigger({
    rootRef: listScrollRef,
    onIntersect: loadMoreEmployees,
    disabled: !hasMore || loadingMore,
  });

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!openRowMenuId) return undefined;

    const handleClickOutside = (event) => {
      if (rowMenuRef.current?.contains(event.target)) return;
      if (event.target.closest('[data-row-menu-trigger="true"]')) return;
      setOpenRowMenuId('');
      setOpenRowMenuContext(null);
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setOpenRowMenuId('');
        setOpenRowMenuContext(null);
      }
    };

    const closeOnViewportChange = () => {
      setOpenRowMenuId('');
      setOpenRowMenuContext(null);
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    window.addEventListener('resize', closeOnViewportChange);
    window.addEventListener('scroll', closeOnViewportChange, true);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
      window.removeEventListener('resize', closeOnViewportChange);
      window.removeEventListener('scroll', closeOnViewportChange, true);
    };
  }, [openRowMenuId]);

  const openRowMenu = (event, employee, linkedContact) => {
    const id = String(employee._id || '');
    if (!id) return;
    if (openRowMenuId === id) {
      setOpenRowMenuId('');
      setOpenRowMenuContext(null);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const menuWidth = 188;
    const menuHeight = 168;
    const top = rect.bottom + menuHeight + 8 > window.innerHeight
      ? Math.max(8, rect.top - menuHeight - 8)
      : Math.min(window.innerHeight - menuHeight - 8, rect.bottom + 8);
    const left = Math.max(8, Math.min(window.innerWidth - menuWidth - 8, rect.right - menuWidth));
    setOpenRowMenuPos({ top, left });
    setOpenRowMenuContext({ employee, linkedContact });
    setOpenRowMenuId(id);
  };

  const departments = useMemo(() => {
    const set = new Set((employees || []).map((item) => String(item.department || '').trim()).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [employees]);

  const teamNames = useMemo(() => {
    const set = new Set((employees || []).map((item) => String(item.team || '').trim()).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [employees]);

  const filtered = useMemo(() => {
    const query = String(search || '').trim().toLowerCase();
    const base = (employees || []).filter((item) => {
      const status = String(item.availability?.status || item.status || '').toLowerCase();
      if (statusFilter !== 'all' && status !== statusFilter) return false;
      if (departmentFilter !== 'all' && String(item.department || '') !== departmentFilter) return false;
      if (teamFilter !== 'all' && String(item.team || '') !== teamFilter) return false;
      if (!query) return true;

      const haystack = [item.name, item.email, item.role, item.department, item.team]
        .map((piece) => String(piece || '').toLowerCase())
        .join(' ');
      return haystack.includes(query);
    });

    return [...base].sort((a, b) => {
      if (sortBy === 'newest') return compareByRecencyDesc(a, b);
      if (sortBy === 'oldest') return compareByRecencyAsc(a, b);
      if (sortBy === 'name') return String(a.name || '').localeCompare(String(b.name || ''));
      if (sortBy === 'velocity') return Number(b.velocity || 0) - Number(a.velocity || 0);
      if (sortBy === 'capacity') return Number(b.capacity?.hoursPerWeek || 0) - Number(a.capacity?.hoursPerWeek || 0);
      return compareByRecencyDesc(a, b);
    });
  }, [employees, search, statusFilter, departmentFilter, teamFilter, sortBy]);

  const handleExportEmployees = useCallback((format) => {
    exportRows({
      rows: filtered,
      format,
      filename: `employees-${new Date().toISOString().slice(0, 10)}`,
      title: 'Employees Export',
      columns: [
        { header: 'Name', value: (row) => row.name || '-' },
        { header: 'Email', value: (row) => row.email || '-' },
        { header: 'Role', value: (row) => row.role || '-' },
        { header: 'Department', value: (row) => row.department || '-' },
        { header: 'Team', value: (row) => row.team || '-' },
        { header: 'Status', value: (row) => row.status || '-' },
        { header: 'Availability', value: (row) => row.availability?.status || '-' },
        { header: 'Capacity', value: (row) => row.capacity?.hoursPerWeek || 0 },
        { header: 'Velocity', value: (row) => row.velocity || 0 },
      ],
    });
  }, [filtered]);

  const metrics = useMemo(() => {
    const total = filtered.length;
    const active = filtered.filter((item) => String(item.status || '').toLowerCase() === 'active').length;
    const avgVelocity = total
      ? Math.round(filtered.reduce((sum, item) => sum + Number(item.velocity || 0), 0) / total)
      : 0;
    const avgCapacity = total
      ? Math.round(filtered.reduce((sum, item) => sum + Number(item.capacity?.hoursPerWeek || 0), 0) / total)
      : 0;
    return {
      total,
      active,
      avgVelocity,
      avgCapacity,
    };
  }, [filtered]);

  useEffect(() => {
    listScrollRef.current?.scrollTo({ top: 0 });
  }, [search, statusFilter, departmentFilter, teamFilter, sortBy]);

  const openCreate = () => {
    setModalMode('create');
    setEditingId('');
    setEmployeeForm(EMPTY_EMPLOYEE);
    setModalOpen(true);
  };

  const openEdit = (employee) => {
    setModalMode('edit');
    setEditingId(String(employee._id || ''));
    setEmployeeForm(normalizeEmployeeForm(employee));
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId('');
    setEmployeeForm(EMPTY_EMPLOYEE);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!String(employeeForm.name || '').trim()) {
      setToast({ tone: 'error', message: 'Employee name is required' });
      return;
    }

    setSaving(true);
    try {
      const payload = buildEmployeePayload(employeeForm);
      if (modalMode === 'edit' && editingId) {
        await updateItem(editingId, payload);
        setToast({ tone: 'success', message: 'Employee updated' });
      } else {
        await createItem(payload);
        setToast({ tone: 'success', message: 'Employee created' });
      }
      closeModal();
    } catch (nextError) {
      setToast({ tone: 'error', message: nextError.message || 'Failed to save employee' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    setSaving(true);
    try {
      await removeItem(deletingId);
      setToast({ tone: 'success', message: 'Employee deleted' });
      setDeletingId('');
    } catch (nextError) {
      setToast({ tone: 'error', message: nextError.message || 'Failed to delete employee' });
    } finally {
      setSaving(false);
    }
  };

  const linkOrUnlinkContact = async (employee, nextContactId) => {
    try {
      await updateItem(employee._id, { contactId: nextContactId || null });
      setToast({ tone: 'success', message: nextContactId ? 'Contact linked' : 'Contact unlinked' });
    } catch (nextError) {
      setToast({ tone: 'error', message: nextError.message || 'Failed to update contact link' });
    }
  };

  const handleCreateTeam = async () => {
    const name = window.prompt('Enter team name');
    if (!name || !String(name).trim()) return;
    try {
      const created = await createTeam({ name: String(name).trim() });
      if (created?.name) {
        setEmployeeForm((current) => ({ ...current, team: created.name }));
      }
      setToast({ tone: 'success', message: 'Team created' });
    } catch (nextError) {
      setToast({ tone: 'error', message: nextError.message || 'Failed to create team' });
    }
  };

  return (
    <main className="sv-employees-page min-h-screen">
      <div className="sv-employees-stack w-full">
        <section className="sv-employees-switch flex flex-wrap items-center gap-3">
          <NavLink
            end
            to={ROUTES.employees}
            className={({ isActive }) =>
              `sv-employees-switch-btn ${
                isActive ? 'is-active' : ''
              }`
            }
          >
            <Icon name="groups" className="sv-icon-btn-icon" />
            <span>Employee Management</span>
          </NavLink>
          <NavLink
            to={ROUTES.contacts}
            className={({ isActive }) =>
              `sv-employees-switch-btn ${
                isActive ? 'is-active' : ''
              }`
            }
          >
            <Icon name="contacts" className="sv-icon-btn-icon" />
            <span>Contacts</span>
          </NavLink>
        </section>

        <section className="sv-card sv-employees-hero">
          <div>
            <span className="sv-employees-eyebrow">
              <Icon name="workspaces" className="sv-icon-btn-icon" />
              Workforce hub
            </span>
            <h1 className="sv-employees-title">Employee Management</h1>
            <p className="sv-employees-subtitle">
              Track capacity, availability, contact links, and team ownership from one focused workspace.
            </p>
          </div>
          <div className="sv-employees-hero-actions">
            <ExportMenu onExport={handleExportEmployees} label="Export" disabled={!filtered.length} />
            <button type="button" onClick={openCreate} className="sv-ctl-btn btn-primary sv-icon-btn">
              <Icon name="person_add" className="sv-icon-btn-icon" />
              <span>New Employee</span>
            </button>
          </div>
        </section>

        <section className="sv-employees-kpis grid grid-cols-1 gap-4 md:grid-cols-4">
          <article className="sv-card sv-employees-kpi is-blue">
            <span className="sv-employees-kpi-icon"><Icon name="groups" /></span>
            <p className="sv-employees-kpi-label">Headcount</p>
            <p className="sv-employees-kpi-value">{metrics.total}</p>
            <small>Filtered employees</small>
          </article>
          <article className="sv-card sv-employees-kpi is-green">
            <span className="sv-employees-kpi-icon"><Icon name="verified_user" /></span>
            <p className="sv-employees-kpi-label">Active</p>
            <p className="sv-employees-kpi-value">{metrics.active}</p>
            <small>Available records</small>
          </article>
          <article className="sv-card sv-employees-kpi is-amber">
            <span className="sv-employees-kpi-icon"><Icon name="speed" /></span>
            <p className="sv-employees-kpi-label">Avg Velocity</p>
            <p className="sv-employees-kpi-value">{metrics.avgVelocity}%</p>
            <small>Delivery signal</small>
          </article>
          <article className="sv-card sv-employees-kpi is-purple">
            <span className="sv-employees-kpi-icon"><Icon name="schedule" /></span>
            <p className="sv-employees-kpi-label">Avg Capacity</p>
            <p className="sv-employees-kpi-value">{metrics.avgCapacity}h</p>
            <small>Weekly capacity</small>
          </article>
        </section>

        <section className="sv-card sv-employees-table-card">
          <div className="sv-employees-filter-bar">
            <div className="sv-employees-filter-main">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name, email, role, team"
                className="sv-ctl-input sv-employees-search"
              />
              <button
                type="button"
                className={`sv-ctl-btn btn-light sv-employees-filter-toggle ${filtersOpen ? 'is-active' : ''}`}
                onClick={() => setFiltersOpen((prev) => !prev)}
              >
                <Icon name="filter_list" className="sv-icon-btn-icon" />
                <span>Filter</span>
              </button>
            </div>

            <div className="sv-employees-filter-actions">
              <span className="sv-employees-result-chip">{filtered.length} shown</span>
            </div>
          </div>
          {filtersOpen ? (
            <div className="sv-employees-filter-panel">
              <SelectDropdown
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { value: 'all', label: 'All availability' },
                  { value: 'available', label: 'Available' },
                  { value: 'busy', label: 'Busy' },
                  { value: 'ooo', label: 'Out of office' },
                  { value: 'leave', label: 'Leave' },
                ]}
                className="sv-employees-field"
              />
              <SelectDropdown
                value={departmentFilter}
                onChange={setDepartmentFilter}
                options={[
                  { value: 'all', label: 'All departments' },
                  ...departments.map((department) => ({ value: department, label: department })),
                ]}
                className="sv-employees-field"
              />
              <SelectDropdown
                value={teamFilter}
                onChange={setTeamFilter}
                options={[
                  { value: 'all', label: 'All teams' },
                  ...teamNames.map((teamName) => ({ value: teamName, label: teamName })),
                ]}
                className="sv-employees-field"
              />
              <SelectDropdown
                value={sortBy}
                onChange={setSortBy}
                options={[
                  { value: 'newest', label: 'Newest' },
                  { value: 'oldest', label: 'Oldest' },
                  { value: 'name', label: 'Name' },
                  { value: 'velocity', label: 'Velocity' },
                  { value: 'capacity', label: 'Capacity' },
                ]}
                className="sv-employees-field"
              />
            </div>
          ) : null}

          {loading ? <p className="px-3 py-6 text-sm text-on-surface-variant">Loading employees...</p> : null}
          {error ? <p className="px-3 py-6 text-sm text-error">{error}</p> : null}

          {!loading && !error ? (
            <>
              <div className="sv-table-scroll sv-list-scroll" ref={listScrollRef}>
                <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-outline-variant/20 text-xs uppercase tracking-wider text-on-surface-variant">
                    <th className="px-3 py-2">Employee</th>
                    <th className="px-3 py-2">Role</th>
                    <th className="px-3 py-2">Department</th>
                    <th className="px-3 py-2">Team</th>
                    <th className="px-3 py-2">Availability</th>
                    <th className="px-3 py-2">Linked Contact</th>
                    <th className="px-3 py-2 sv-row-action-heading">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((employee) => {
                    const linkedContact = contacts.find((contact) => String(contact._id) === String(employee.contactId || ''));
                    return (
                      <tr key={employee._id} className="border-b border-outline-variant/10">
                        <td className="px-3 py-3">
                          <button
                            type="button"
                            className="sv-name-open-btn text-sm font-semibold text-on-surface"
                            onClick={() => navigate(ROUTES.employeeDetail.replace(':employeeId', employee._id))}
                          >
                            {employee.name || 'Unnamed'}
                          </button>
                          <p className="text-xs text-on-surface-variant">{employee.email || '-'}</p>
                        </td>
                        <td className="px-3 py-3 text-sm text-on-surface-variant">{employee.role || '-'}</td>
                        <td className="px-3 py-3 text-sm text-on-surface-variant">{employee.department || '-'}</td>
                        <td className="px-3 py-3 text-sm text-on-surface-variant">{employee.team || '-'}</td>
                        <td className="px-3 py-3 text-sm text-on-surface-variant">{employee.availability?.status || 'available'}</td>
                        <td className="px-3 py-3 text-sm">
                          {linkedContact ? (
                            <button
                              type="button"
                              onClick={() => navigate(`${ROUTES.contacts}?employeeId=${employee._id}`)}
                              className="sv-employee-link-chip"
                            >
                              <Icon name="contacts" className="sv-icon-btn-icon" />
                              <span>{linkedContact.name || 'Linked'}</span>
                            </button>
                          ) : (
                            <span className="text-on-surface-variant">Not linked</span>
                          )}
                        </td>
                        <td className="px-3 py-3 sv-row-action-cell sv-employees-actions-cell">
                          <div className="sv-row-menu-container">
                            <button
                              type="button"
                              className="sv-row-menu-btn"
                              data-row-menu-trigger="true"
                              aria-label="Open actions"
                              aria-expanded={openRowMenuId === String(employee._id)}
                              onClick={(event) => openRowMenu(event, employee, linkedContact)}
                            >
                              <Icon name="more_vert" className="text-lg" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {!filtered.length ? (
                    <tr>
                      <td colSpan={7} className="px-3 py-8 text-center text-sm text-on-surface-variant">No employees found.</td>
                    </tr>
                  ) : null}
                  {filtered.length ? (
                    <tr>
                      <td colSpan={7} className="sv-list-sentinel-cell">
                        <span ref={loadMoreRef} className="sv-list-sentinel" />
                        {loadingMore ? 'Loading more employees...' : hasMore ? 'Scroll for more' : 'End of list'}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
                </table>
              </div>
            </>
          ) : null}
        </section>
      </div>

      {openRowMenuId && openRowMenuContext?.employee ? (
        <div
          ref={rowMenuRef}
          className="sv-row-menu-popover sv-row-menu-popover-fixed"
          style={{ top: `${openRowMenuPos.top}px`, left: `${openRowMenuPos.left}px` }}
        >
          <button
            type="button"
            className="sv-row-menu-item"
            onClick={() => {
              const targetId = openRowMenuContext.employee._id;
              setOpenRowMenuId('');
              setOpenRowMenuContext(null);
              navigate(ROUTES.employeeDetail.replace(':employeeId', targetId));
            }}
          >
            <Icon name="open_in_new" className="sv-icon-btn-icon" />
            <span>Open</span>
          </button>
          <button
            type="button"
            className="sv-row-menu-item"
            onClick={() => {
              const targetEmployee = openRowMenuContext.employee;
              setOpenRowMenuId('');
              setOpenRowMenuContext(null);
              openEdit(targetEmployee);
            }}
          >
            <Icon name="edit" className="sv-icon-btn-icon" />
            <span>Quick Edit</span>
          </button>
          {openRowMenuContext.linkedContact ? (
            <button
              type="button"
              className="sv-row-menu-item is-danger"
              onClick={() => {
                const targetEmployee = openRowMenuContext.employee;
                setOpenRowMenuId('');
                setOpenRowMenuContext(null);
                linkOrUnlinkContact(targetEmployee, null);
              }}
            >
              <Icon name="link_off" className="sv-icon-btn-icon" />
              <span>Unlink</span>
            </button>
          ) : (
            <button
              type="button"
              className="sv-row-menu-item"
              onClick={() => {
                const targetEmployee = openRowMenuContext.employee;
                setOpenRowMenuId('');
                setOpenRowMenuContext(null);
                openEdit(targetEmployee);
              }}
            >
              <Icon name="link" className="sv-icon-btn-icon" />
              <span>Link Contact</span>
            </button>
          )}
          <button
            type="button"
            className="sv-row-menu-item is-danger"
            onClick={() => {
              const targetId = String(openRowMenuContext.employee._id || '');
              setOpenRowMenuId('');
              setOpenRowMenuContext(null);
              setDeletingId(targetId);
            }}
          >
            <Icon name="delete" className="sv-icon-btn-icon" />
            <span>Delete</span>
          </button>
        </div>
      ) : null}

      <EmployeeFormModal
        open={modalOpen}
        mode={modalMode}
        form={employeeForm}
        onChange={(field, value) => setEmployeeForm((current) => ({ ...current, [field]: value }))}
        onClose={closeModal}
        onSubmit={handleSubmit}
        saving={saving}
        employees={employees || []}
        contacts={contacts || []}
        teams={teams || []}
        editingId={editingId}
        onCreateTeam={handleCreateTeam}
      />

      {deletingId ? (
        <div className="sv-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="sv-card w-full max-w-md p-5">
            <h3 className="text-lg font-semibold text-on-surface">Delete Employee?</h3>
            <p className="mt-2 text-sm text-on-surface-variant">This will remove the employee and unlink related contact references.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setDeletingId('')} className="sv-ctl-btn btn-light sv-icon-btn">
                <Icon name="close" className="sv-icon-btn-icon" />
                <span>Cancel</span>
              </button>
              <button type="button" onClick={handleDelete} className="sv-ctl-btn btn-danger sv-icon-btn">
                <Icon name="delete" className="sv-icon-btn-icon" />
                <span>{saving ? 'Deleting...' : 'Delete'}</span>
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

export default EmployeeManagementPage;

import { useMemo, useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { ROUTES } from '../../routes/routePaths';
import { useEmployees } from '../../hooks/useEmployees';
import { useContacts } from '../../hooks/useContacts';
import { useTeams } from '../../hooks/useTeams';
import Icon from '../../components/ui/Icon';

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <div className="w-full max-w-3xl rounded-2xl bg-surface-container-lowest p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-on-surface">{mode === 'edit' ? 'Edit Employee' : 'Create Employee'}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container"
          >
            <Icon name="close" className="text-lg" />
          </button>
        </div>

        <form
          onSubmit={onSubmit}
          className="grid grid-cols-1 gap-3 md:grid-cols-2"
        >
          <input className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm" placeholder="Full name *" value={form.name} onChange={(e) => onChange('name', e.target.value)} required />
          <input className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm" placeholder="Email" value={form.email} onChange={(e) => onChange('email', e.target.value)} />
          <input className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm" placeholder="Role" value={form.role} onChange={(e) => onChange('role', e.target.value)} />
          <input className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm" placeholder="Department" value={form.department} onChange={(e) => onChange('department', e.target.value)} />
          <input className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm" placeholder="Designation" value={form.designation} onChange={(e) => onChange('designation', e.target.value)} />
          <input className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm" placeholder="Phone" value={form.phone} onChange={(e) => onChange('phone', e.target.value)} />

          <div className="flex items-center gap-2">
            <select className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm" value={form.team} onChange={(e) => onChange('team', e.target.value)}>
              <option value="">Select team</option>
              {teams.map((team) => (
                <option key={team._id} value={team.name || ''}>{team.name || 'Unnamed team'}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={onCreateTeam}
              className="whitespace-nowrap rounded-lg border border-outline-variant px-3 py-2 text-xs font-semibold"
            >
              New Team
            </button>
          </div>

          <input className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm" placeholder="Employee Code" value={form.employeeCode} onChange={(e) => onChange('employeeCode', e.target.value)} />

          <select className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm" value={form.status} onChange={(e) => onChange('status', e.target.value)}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="archived">Archived</option>
          </select>

          <select className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm" value={form.availabilityStatus} onChange={(e) => onChange('availabilityStatus', e.target.value)}>
            <option value="available">Available</option>
            <option value="busy">Busy</option>
            <option value="ooo">Out Of Office</option>
            <option value="leave">On Leave</option>
          </select>

          <input type="number" min="1" className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm" placeholder="Hours / week" value={form.hoursPerWeek} onChange={(e) => onChange('hoursPerWeek', e.target.value)} />
          <input type="number" min="0" className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm" placeholder="Velocity" value={form.velocity} onChange={(e) => onChange('velocity', e.target.value)} />

          <select
            className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm"
            value={form.managerId}
            onChange={(e) => {
              const managerId = e.target.value;
              const manager = managerOptions.find((item) => String(item._id) === String(managerId));
              onChange('managerId', managerId);
              onChange('managerName', manager?.name || '');
            }}
          >
            <option value="">No manager</option>
            {managerOptions.map((employee) => (
              <option key={employee._id} value={employee._id}>{employee.name || 'Unnamed'}</option>
            ))}
          </select>

          <select className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm" value={form.contactId} onChange={(e) => onChange('contactId', e.target.value)}>
            <option value="">No linked contact</option>
            {contacts.map((contact) => (
              <option key={contact._id} value={contact._id}>{contact.name || 'Unnamed'}{contact.email ? ` (${contact.email})` : ''}</option>
            ))}
          </select>

          <div className="md:col-span-2 flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-outline-variant px-4 py-2 text-sm font-semibold">Cancel</button>
            <button type="submit" disabled={saving} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
              {saving ? 'Saving...' : mode === 'edit' ? 'Save Changes' : 'Create Employee'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EmployeeManagementPage() {
  const navigate = useNavigate();
  const { items: employees, loading, error, createItem, updateItem, removeItem } = useEmployees();
  const { items: contacts } = useContacts();
  const { teams, createTeam } = useTeams();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [teamFilter, setTeamFilter] = useState('all');
  const [sortBy, setSortBy] = useState('recent');

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [editingId, setEditingId] = useState('');
  const [employeeForm, setEmployeeForm] = useState(EMPTY_EMPLOYEE);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

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
      if (sortBy === 'name') return String(a.name || '').localeCompare(String(b.name || ''));
      if (sortBy === 'velocity') return Number(b.velocity || 0) - Number(a.velocity || 0);
      if (sortBy === 'capacity') return Number(b.capacity?.hoursPerWeek || 0) - Number(a.capacity?.hoursPerWeek || 0);
      return new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime();
    });
  }, [employees, search, statusFilter, departmentFilter, teamFilter, sortBy]);

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
    <main className="relative min-h-screen">
      <div className="mx-auto max-w-[1400px] space-y-6 p-8">
        <section className="flex flex-wrap items-center gap-3">
          <NavLink
            end
            to={ROUTES.employees}
            className={({ isActive }) =>
              `rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors ${
                isActive ? 'bg-primary text-white shadow-sm' : 'bg-surface-container-low text-on-surface hover:bg-surface-container-high'
              }`
            }
          >
            Employee Management
          </NavLink>
          <NavLink
            to={ROUTES.contacts}
            className={({ isActive }) =>
              `rounded-xl px-5 py-2.5 text-sm font-semibold transition-colors ${
                isActive ? 'bg-primary text-white shadow-sm' : 'bg-surface-container-low text-on-surface hover:bg-surface-container-high'
              }`
            }
          >
            Contacts
          </NavLink>
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <article className="rounded-xl bg-surface-container-lowest p-4">
            <p className="text-xs uppercase text-on-surface-variant">Headcount</p>
            <p className="mt-2 text-3xl font-bold text-on-surface">{metrics.total}</p>
          </article>
          <article className="rounded-xl bg-surface-container-lowest p-4">
            <p className="text-xs uppercase text-on-surface-variant">Active</p>
            <p className="mt-2 text-3xl font-bold text-on-surface">{metrics.active}</p>
          </article>
          <article className="rounded-xl bg-surface-container-lowest p-4">
            <p className="text-xs uppercase text-on-surface-variant">Avg Velocity</p>
            <p className="mt-2 text-3xl font-bold text-on-surface">{metrics.avgVelocity}%</p>
          </article>
          <article className="rounded-xl bg-surface-container-lowest p-4">
            <p className="text-xs uppercase text-on-surface-variant">Avg Capacity</p>
            <p className="mt-2 text-3xl font-bold text-on-surface">{metrics.avgCapacity}h</p>
          </article>
        </section>

        <section className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="grid flex-1 grid-cols-1 gap-3 md:grid-cols-5">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by name, email, role, team"
                className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm md:col-span-2"
              />
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm">
                <option value="all">All availability</option>
                <option value="available">Available</option>
                <option value="busy">Busy</option>
                <option value="ooo">Out of office</option>
                <option value="leave">Leave</option>
              </select>
              <select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)} className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm">
                <option value="all">All departments</option>
                {departments.map((department) => (
                  <option key={department} value={department}>{department}</option>
                ))}
              </select>
              <select value={teamFilter} onChange={(event) => setTeamFilter(event.target.value)} className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm">
                <option value="all">All teams</option>
                {teamNames.map((teamName) => (
                  <option key={teamName} value={teamName}>{teamName}</option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm">
                <option value="recent">Recently updated</option>
                <option value="name">Name</option>
                <option value="velocity">Velocity</option>
                <option value="capacity">Capacity</option>
              </select>
              <button type="button" onClick={openCreate} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white">New Employee</button>
            </div>
          </div>

          {loading ? <p className="px-3 py-6 text-sm text-on-surface-variant">Loading employees...</p> : null}
          {error ? <p className="px-3 py-6 text-sm text-error">{error}</p> : null}

          {!loading && !error ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-outline-variant/20 text-xs uppercase tracking-wider text-on-surface-variant">
                    <th className="px-3 py-2">Employee</th>
                    <th className="px-3 py-2">Role</th>
                    <th className="px-3 py-2">Department</th>
                    <th className="px-3 py-2">Team</th>
                    <th className="px-3 py-2">Availability</th>
                    <th className="px-3 py-2">Linked Contact</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((employee) => {
                    const linkedContact = contacts.find((contact) => String(contact._id) === String(employee.contactId || ''));
                    return (
                      <tr key={employee._id} className="border-b border-outline-variant/10">
                        <td className="px-3 py-3">
                          <p className="text-sm font-semibold text-on-surface">{employee.name || 'Unnamed'}</p>
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
                              className="text-primary hover:underline"
                            >
                              {linkedContact.name || 'Linked'}
                            </button>
                          ) : (
                            <span className="text-on-surface-variant">Not linked</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <div className="inline-flex items-center gap-2">
                            <button type="button" onClick={() => navigate(ROUTES.employeeDetail.replace(':employeeId', employee._id))} className="rounded bg-surface-container px-2 py-1 text-xs font-semibold">Open</button>
                            <button type="button" onClick={() => openEdit(employee)} className="rounded bg-surface-container px-2 py-1 text-xs font-semibold">Quick Edit</button>
                            {linkedContact ? (
                              <button type="button" onClick={() => linkOrUnlinkContact(employee, null)} className="rounded bg-surface-container px-2 py-1 text-xs font-semibold text-error">Unlink</button>
                            ) : (
                              <button type="button" onClick={() => openEdit(employee)} className="rounded bg-surface-container px-2 py-1 text-xs font-semibold text-primary">Link Contact</button>
                            )}
                            <button type="button" onClick={() => setDeletingId(String(employee._id))} className="rounded bg-surface-container px-2 py-1 text-xs font-semibold text-error">Delete</button>
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
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      </div>

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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded-2xl bg-surface-container-lowest p-5 shadow-2xl">
            <h3 className="text-lg font-semibold text-on-surface">Delete Employee?</h3>
            <p className="mt-2 text-sm text-on-surface-variant">This will remove the employee and unlink related contact references.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setDeletingId('')} className="rounded-lg border border-outline-variant px-4 py-2 text-sm font-semibold">Cancel</button>
              <button type="button" onClick={handleDelete} className="rounded-lg bg-error px-4 py-2 text-sm font-semibold text-white">{saving ? 'Deleting...' : 'Delete'}</button>
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

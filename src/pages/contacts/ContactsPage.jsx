import { useMemo, useState, useEffect } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useContacts } from '../../hooks/useContacts';
import { useEmployees } from '../../hooks/useEmployees';
import { ROUTES } from '../../routes/routePaths';
import Icon from '../../components/ui/Icon';

const EMPTY_FORM = {
  name: '',
  company: '',
  email: '',
  phone: '',
  website: '',
  address: '',
  role: '',
  department: '',
  project: '',
  status: 'active',
  avatarUrl: '',
  employeeId: '',
};

function normalizeForm(contact) {
  return {
    name: contact?.name || '',
    company: contact?.company || '',
    email: contact?.email || '',
    phone: contact?.phone || '',
    website: contact?.website || '',
    address: contact?.address || '',
    role: contact?.role || '',
    department: contact?.department || '',
    project: contact?.project || '',
    status: contact?.status || 'active',
    avatarUrl: contact?.avatarUrl || '',
    employeeId: contact?.employeeId || '',
  };
}

function buildPayload(form) {
  return {
    name: String(form.name || '').trim(),
    company: String(form.company || '').trim(),
    email: String(form.email || '').trim().toLowerCase(),
    phone: String(form.phone || '').trim(),
    website: String(form.website || '').trim(),
    address: String(form.address || '').trim(),
    role: String(form.role || '').trim(),
    department: String(form.department || '').trim(),
    project: String(form.project || '').trim(),
    status: form.status || 'active',
    avatarUrl: String(form.avatarUrl || '').trim(),
    employeeId: form.employeeId || null,
  };
}

function ContactModal({ open, mode, form, onChange, onClose, onSubmit, busy, employees, formError }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
      <div className="w-full max-w-3xl rounded-2xl bg-surface-container-lowest p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-xl font-semibold text-on-surface">{mode === 'edit' ? 'Edit Contact' : 'Create Contact'}</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container">
            <Icon name="close" className="text-lg" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <input value={form.name} onChange={(e) => onChange('name', e.target.value)} placeholder="Full name *" required className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm" />
          <input value={form.company} onChange={(e) => onChange('company', e.target.value)} placeholder="Company" className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm" />
          <input value={form.email} onChange={(e) => onChange('email', e.target.value)} placeholder="Email" className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm" />
          <input value={form.phone} onChange={(e) => onChange('phone', e.target.value)} placeholder="Phone" className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm" />
          <input value={form.website} onChange={(e) => onChange('website', e.target.value)} placeholder="Website" className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm" />
          <input value={form.address} onChange={(e) => onChange('address', e.target.value)} placeholder="Address" className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm" />
          <input value={form.role} onChange={(e) => onChange('role', e.target.value)} placeholder="Role" className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm" />
          <input value={form.department} onChange={(e) => onChange('department', e.target.value)} placeholder="Department" className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm" />
          <input value={form.project} onChange={(e) => onChange('project', e.target.value)} placeholder="Project" className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm" />

          <select value={form.status} onChange={(e) => onChange('status', e.target.value)} className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm">
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          <select value={form.employeeId} onChange={(e) => onChange('employeeId', e.target.value)} className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm">
            <option value="">No linked employee</option>
            {employees.map((employee) => (
              <option key={employee._id} value={employee._id}>{employee.name || 'Unnamed'}{employee.email ? ` (${employee.email})` : ''}</option>
            ))}
          </select>

          <input value={form.avatarUrl} onChange={(e) => onChange('avatarUrl', e.target.value)} placeholder="Avatar URL" className="md:col-span-2 rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm" />

          {formError ? <p className="md:col-span-2 text-sm text-error">{formError}</p> : null}

          <div className="md:col-span-2 flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-outline-variant px-4 py-2 text-sm font-semibold">Cancel</button>
            <button type="submit" disabled={busy} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
              {busy ? 'Saving...' : mode === 'edit' ? 'Save Changes' : 'Create Contact'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ContactsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { items: contacts, loading, error, createItem, updateItem, removeItem } = useContacts();
  const { items: employees } = useEmployees();

  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [sortBy, setSortBy] = useState('updatedAt');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState('');
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [deleteId, setDeleteId] = useState('');
  const [toast, setToast] = useState(null);
  const linkedEmployeeFilter = useMemo(() => new URLSearchParams(location.search).get('employeeId') || '', [location.search]);
  const filteredEmployee = useMemo(
    () => (linkedEmployeeFilter ? (employees || []).find((item) => String(item._id) === String(linkedEmployeeFilter)) : null),
    [employees, linkedEmployeeFilter],
  );

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  const departments = useMemo(() => {
    const set = new Set((contacts || []).map((item) => String(item.department || '').trim()).filter(Boolean));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [contacts]);

  const filtered = useMemo(() => {
    const query = String(search || '').trim().toLowerCase();
    const base = (contacts || []).filter((item) => {
      if (linkedEmployeeFilter) {
        const byEmployeeId = String(item.employeeId || '') === String(linkedEmployeeFilter);
        const byEmployeeContactId = String(item._id || '') === String(filteredEmployee?.contactId || '');
        if (!byEmployeeId && !byEmployeeContactId) return false;
      }
      if (departmentFilter !== 'all' && String(item.department || '') !== departmentFilter) return false;
      if (!query) return true;
      const haystack = [item.name, item.email, item.role, item.department, item.project, item.company]
        .map((chunk) => String(chunk || '').toLowerCase())
        .join(' ');
      return haystack.includes(query);
    });

    return [...base].sort((a, b) => {
      if (sortBy === 'name') return String(a.name || '').localeCompare(String(b.name || ''));
      if (sortBy === 'department') return String(a.department || '').localeCompare(String(b.department || ''));
      return new Date(b.updatedAt || b.createdAt || 0).getTime() - new Date(a.updatedAt || a.createdAt || 0).getTime();
    });
  }, [contacts, linkedEmployeeFilter, filteredEmployee?.contactId, departmentFilter, search, sortBy]);

  const openCreate = () => {
    setModalMode('create');
    setEditingId('');
    setForm(EMPTY_FORM);
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (contact) => {
    setModalMode('edit');
    setEditingId(String(contact._id || ''));
    setForm(normalizeForm(contact));
    setFormError('');
    setModalOpen(true);
  };

  const closeModal = () => {
    if (busy) return;
    setModalOpen(false);
    setEditingId('');
    setForm(EMPTY_FORM);
    setFormError('');
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    const payload = buildPayload(form);

    if (!payload.name) {
      setFormError('Name is required');
      return;
    }
    if (payload.email && !/^\S+@\S+\.\S+$/.test(payload.email)) {
      setFormError('Email format is invalid');
      return;
    }

    setBusy(true);
    setFormError('');
    try {
      if (editingId) {
        await updateItem(editingId, payload);
        setToast({ tone: 'success', message: 'Contact updated' });
      } else {
        await createItem(payload);
        setToast({ tone: 'success', message: 'Contact created' });
      }
      closeModal();
    } catch (nextError) {
      setFormError(nextError.message || 'Failed to save contact');
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async () => {
    if (!deleteId) return;
    setBusy(true);
    try {
      await removeItem(deleteId);
      setToast({ tone: 'success', message: 'Contact deleted' });
      setDeleteId('');
    } catch (nextError) {
      setToast({ tone: 'error', message: nextError.message || 'Failed to delete contact' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-screen flex-col">
      <div className="flex-1 space-y-6 overflow-y-auto p-8">
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

        <section className="mb-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="mb-2 text-3xl font-extrabold tracking-tight text-on-surface">Contacts</h2>
            <p className="max-w-md text-sm text-on-surface-variant">Manage collaborator contacts used across tasks and projects.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-outline-variant/10 bg-surface-container-low px-4 py-3 text-sm">{filtered.length} contacts</div>
            <button type="button" onClick={openCreate} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white">New Contact</button>
          </div>
        </section>

        {error ? <section className="rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">{error}</section> : null}

        <section className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-4 shadow-sm">
          <div className="mb-4 grid grid-cols-1 gap-3 md:grid-cols-[1fr_180px_180px]">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name, email, role..."
              className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm"
            />
            <select
              value={departmentFilter}
              onChange={(event) => setDepartmentFilter(event.target.value)}
              className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm"
            >
              <option value="all">All departments</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
              className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm"
            >
              <option value="updatedAt">Recently updated</option>
              <option value="name">Name</option>
              <option value="department">Department</option>
            </select>
          </div>

          {loading ? <p className="px-3 py-6 text-sm text-on-surface-variant">Loading contacts...</p> : null}

          {!loading ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-outline-variant/20 text-xs uppercase tracking-wider text-on-surface-variant">
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Company</th>
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2">Department</th>
                    <th className="px-3 py-2">Linked Employee</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((contact) => {
                    const linkedEmployee = employees.find(
                      (employee) =>
                        String(employee._id) === String(contact.employeeId || '') ||
                        String(employee.contactId || '') === String(contact._id || ''),
                    );
                    return (
                      <tr key={contact._id} className="border-b border-outline-variant/10">
                        <td className="px-3 py-3 text-sm font-medium text-on-surface">{contact.name || '-'}</td>
                        <td className="px-3 py-3 text-sm text-on-surface-variant">{contact.company || '-'}</td>
                        <td className="px-3 py-3 text-sm text-on-surface-variant">{contact.email || '-'}</td>
                        <td className="px-3 py-3 text-sm text-on-surface-variant">{contact.department || '-'}</td>
                        <td className="px-3 py-3 text-sm">
                          {linkedEmployee ? (
                            <button
                              type="button"
                              onClick={() => navigate(ROUTES.employeeDetail.replace(':employeeId', linkedEmployee._id))}
                              className="rounded-full bg-primary/10 px-2 py-1 text-xs font-semibold text-primary"
                            >
                              {linkedEmployee.name || 'Open employee'}
                            </button>
                          ) : (
                            <span className="text-xs text-on-surface-variant">Not linked</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right">
                          <div className="inline-flex items-center gap-3">
                            <button type="button" onClick={() => openEdit(contact)} className="text-xs font-semibold text-primary hover:underline">Edit</button>
                            <button type="button" onClick={() => setDeleteId(String(contact._id))} className="text-xs font-semibold text-error hover:underline">Delete</button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {!filtered.length ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center text-sm text-on-surface-variant">No contacts found.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      </div>

      <ContactModal
        open={modalOpen}
        mode={modalMode}
        form={form}
        onChange={(field, value) => setForm((current) => ({ ...current, [field]: value }))}
        onClose={closeModal}
        onSubmit={onSubmit}
        busy={busy}
        employees={employees || []}
        formError={formError}
      />

      {deleteId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-md rounded-2xl bg-surface-container-lowest p-5 shadow-2xl">
            <h3 className="text-lg font-semibold text-on-surface">Delete Contact?</h3>
            <p className="mt-2 text-sm text-on-surface-variant">This will remove the contact and clear linked employee references.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setDeleteId('')} className="rounded-lg border border-outline-variant px-4 py-2 text-sm font-semibold">Cancel</button>
              <button type="button" onClick={onDelete} className="rounded-lg bg-error px-4 py-2 text-sm font-semibold text-white">{busy ? 'Deleting...' : 'Delete'}</button>
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

export default ContactsPage;

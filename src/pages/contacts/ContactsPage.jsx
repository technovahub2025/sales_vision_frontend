import { useMemo, useState, useEffect, useRef } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useContacts } from '../../hooks/useContacts';
import { useEmployees } from '../../hooks/useEmployees';
import { ROUTES } from '../../routes/routePaths';
import Icon from '../../components/ui/Icon';

const DEFAULT_PAGE_SIZE = 8;
const PAGE_SIZE_OPTIONS = [8, 15, 25];

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
    <div className="sv-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="sv-card sv-contacts-modal">
        <div className="sv-contacts-modal-head">
          <h3 className="sv-contacts-modal-title">{mode === 'edit' ? 'Edit Contact' : 'Create Contact'}</h3>
          <button type="button" onClick={onClose} className="sv-modal-close-btn" aria-label="Close">
            <Icon name="close" className="text-lg" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="sv-contacts-modal-form">
          <input value={form.name} onChange={(e) => onChange('name', e.target.value)} placeholder="Full name *" required className="sv-ctl-input sv-contacts-field" />
          <input value={form.company} onChange={(e) => onChange('company', e.target.value)} placeholder="Company" className="sv-ctl-input sv-contacts-field" />
          <input value={form.email} onChange={(e) => onChange('email', e.target.value)} placeholder="Email" className="sv-ctl-input sv-contacts-field" />
          <input value={form.phone} onChange={(e) => onChange('phone', e.target.value)} placeholder="Phone" className="sv-ctl-input sv-contacts-field" />
          <input value={form.website} onChange={(e) => onChange('website', e.target.value)} placeholder="Website" className="sv-ctl-input sv-contacts-field" />
          <input value={form.address} onChange={(e) => onChange('address', e.target.value)} placeholder="Address" className="sv-ctl-input sv-contacts-field" />
          <input value={form.role} onChange={(e) => onChange('role', e.target.value)} placeholder="Role" className="sv-ctl-input sv-contacts-field" />
          <input value={form.department} onChange={(e) => onChange('department', e.target.value)} placeholder="Department" className="sv-ctl-input sv-contacts-field" />
          <input value={form.project} onChange={(e) => onChange('project', e.target.value)} placeholder="Project" className="sv-ctl-input sv-contacts-field" />

          <select value={form.status} onChange={(e) => onChange('status', e.target.value)} className="sv-ctl-select sv-contacts-field">
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>

          <select value={form.employeeId} onChange={(e) => onChange('employeeId', e.target.value)} className="sv-ctl-select sv-contacts-field">
            <option value="">No linked employee</option>
            {employees.map((employee) => (
              <option key={employee._id} value={employee._id}>{employee.name || 'Unnamed'}{employee.email ? ` (${employee.email})` : ''}</option>
            ))}
          </select>

          <input value={form.avatarUrl} onChange={(e) => onChange('avatarUrl', e.target.value)} placeholder="Avatar URL" className="md:col-span-2 sv-ctl-input sv-contacts-field" />

          {formError ? <p className="md:col-span-2 text-sm text-error">{formError}</p> : null}

          <div className="md:col-span-2 sv-contacts-modal-actions">
            <button type="button" onClick={onClose} className="sv-ctl-btn btn-light sv-icon-btn">
              <Icon name="close" className="sv-icon-btn-icon" />
              <span>Cancel</span>
            </button>
            <button type="submit" disabled={busy} className="sv-ctl-btn btn-primary sv-icon-btn">
              <Icon name={mode === 'edit' ? 'save' : 'person_add'} className="sv-icon-btn-icon" />
              <span>{busy ? 'Saving...' : mode === 'edit' ? 'Save Changes' : 'Create Contact'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ContactsPagination({ page, totalPages, totalItems, pageSize, onPageChange, onPageSizeChange }) {
  if (totalItems <= 0) return null;
  const safePage = Math.max(1, Math.min(page, totalPages));
  const startItem = (safePage - 1) * pageSize + 1;
  const endItem = Math.min(totalItems, safePage * pageSize);
  const pages = Array.from({ length: totalPages }, (_, idx) => idx + 1);

  return (
    <div className="sv-leads-pagination">
      <div className="sv-leads-pagination-meta">
        <span className="sv-leads-pagination-text">Showing {startItem}-{endItem} of {totalItems}</span>
        <label className="sv-leads-pagination-size">
          <span>Rows per page</span>
          <select
            className="form-select form-select-sm sv-ctl-select sv-leads-page-size"
            value={pageSize}
            onChange={(event) => onPageSizeChange(Number(event.target.value))}
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={`contacts-page-size-${size}`} value={size}>{size}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="sv-leads-pagination-controls">
        <button
          type="button"
          className="btn btn-light btn-sm sv-ctl-btn sv-leads-page-btn"
          onClick={() => onPageChange(Math.max(1, safePage - 1))}
          disabled={safePage <= 1}
        >
          Prev
        </button>
        <div className="sv-leads-page-list">
          {pages.map((nextPage) => (
            <button
              key={`contacts-page-${nextPage}`}
              type="button"
              className={`btn btn-sm sv-ctl-btn sv-leads-page-btn ${nextPage === safePage ? 'is-active' : ''}`}
              onClick={() => onPageChange(nextPage)}
            >
              {nextPage}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="btn btn-light btn-sm sv-ctl-btn sv-leads-page-btn"
          onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
          disabled={safePage >= totalPages}
        >
          Next
        </button>
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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [departmentFilter, setDepartmentFilter] = useState('all');
  const [sortBy, setSortBy] = useState('updatedAt');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState('create');
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState('');
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const [deleteId, setDeleteId] = useState('');
  const [toast, setToast] = useState(null);
  const [openRowMenuId, setOpenRowMenuId] = useState('');
  const [openRowMenuPos, setOpenRowMenuPos] = useState({ top: 0, left: 0 });
  const [openRowMenuContext, setOpenRowMenuContext] = useState(null);
  const rowMenuRef = useRef(null);
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

  const openRowMenu = (event, contact, linkedEmployee) => {
    const id = String(contact._id || '');
    if (!id) return;
    if (openRowMenuId === id) {
      setOpenRowMenuId('');
      setOpenRowMenuContext(null);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const menuWidth = 188;
    const itemCount = linkedEmployee ? 3 : 2;
    const menuHeight = itemCount * 34 + 10;
    const top = rect.bottom + menuHeight + 8 > window.innerHeight
      ? Math.max(8, rect.top - menuHeight - 8)
      : Math.min(window.innerHeight - menuHeight - 8, rect.bottom + 8);
    const left = Math.max(8, Math.min(window.innerWidth - menuWidth - 8, rect.right - menuWidth));
    setOpenRowMenuPos({ top, left });
    setOpenRowMenuContext({ contact, linkedEmployee });
    setOpenRowMenuId(id);
  };

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

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  const pagedContacts = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  useEffect(() => {
    setPage(1);
  }, [search, departmentFilter, sortBy, pageSize, linkedEmployeeFilter]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

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
    <main className="sv-contacts-page flex min-h-screen flex-col">
      <div className="sv-contacts-stack flex-1 overflow-y-auto">
        <section className="sv-contacts-switch flex flex-wrap items-center gap-3">
          <NavLink
            end
            to={ROUTES.employees}
            className={({ isActive }) =>
              `sv-contacts-switch-btn ${
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
              `sv-contacts-switch-btn ${
                isActive ? 'is-active' : ''
              }`
            }
          >
            <Icon name="contacts" className="sv-icon-btn-icon" />
            <span>Contacts</span>
          </NavLink>
        </section>

        <section className="mb-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="mb-2 text-3xl font-extrabold tracking-tight text-on-surface">Contacts</h2>
            <p className="max-w-md text-sm text-on-surface-variant">Manage collaborator contacts used across tasks and projects.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-outline-variant/10 bg-surface-container-low px-4 py-3 text-sm">{filtered.length} contacts</div>
            <button type="button" onClick={openCreate} className="sv-ctl-btn btn-primary sv-icon-btn">
              <Icon name="person_add" className="sv-icon-btn-icon" />
              <span>New Contact</span>
            </button>
          </div>
        </section>

        {error ? <section className="rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">{error}</section> : null}

        <section className="sv-card sv-contacts-table-card">
          <div className="sv-contacts-filter-bar">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by name, email, role..."
              className="sv-ctl-input sv-contacts-search"
            />
            <button
              type="button"
              className={`sv-ctl-btn btn-light sv-contacts-filter-toggle ${filtersOpen ? 'is-active' : ''}`}
              onClick={() => setFiltersOpen((prev) => !prev)}
            >
              <Icon name="filter_list" className="sv-icon-btn-icon" />
              <span>Filter</span>
            </button>
          </div>
          {filtersOpen ? (
            <div className="sv-contacts-filter-panel">
              <select
                value={departmentFilter}
                onChange={(event) => setDepartmentFilter(event.target.value)}
                className="sv-ctl-select"
              >
                <option value="all">All departments</option>
                {departments.map((dept) => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}
                className="sv-ctl-select"
              >
                <option value="updatedAt">Recently updated</option>
                <option value="name">Name</option>
                <option value="department">Department</option>
              </select>
            </div>
          ) : null}

          {loading ? <p className="px-3 py-6 text-sm text-on-surface-variant">Loading contacts...</p> : null}

          {!loading ? (
            <>
              <div className="sv-table-scroll">
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
                  {pagedContacts.map((contact) => {
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
                              className="sv-employee-link-chip"
                            >
                              <Icon name="badge" className="sv-icon-btn-icon" />
                              <span>{linkedEmployee.name || 'Open employee'}</span>
                            </button>
                          ) : (
                            <span className="text-xs text-on-surface-variant">Not linked</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right sv-employees-actions-cell">
                          <div className="sv-row-menu-container">
                            <button
                              type="button"
                              className="sv-row-menu-btn"
                              data-row-menu-trigger="true"
                              aria-label="Open actions"
                              aria-expanded={openRowMenuId === String(contact._id)}
                              onClick={(event) => openRowMenu(event, contact, linkedEmployee)}
                            >
                              <Icon name="more_vert" className="text-lg" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {!pagedContacts.length ? (
                    <tr>
                      <td colSpan={6} className="px-3 py-8 text-center text-sm text-on-surface-variant">No contacts found.</td>
                    </tr>
                  ) : null}
                </tbody>
                </table>
              </div>
              <ContactsPagination
                page={page}
                totalPages={totalPages}
                totalItems={filtered.length}
                pageSize={pageSize}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
              />
            </>
          ) : null}
        </section>
      </div>

      {openRowMenuId && openRowMenuContext?.contact ? (
        <div
          ref={rowMenuRef}
          className="sv-row-menu-popover sv-row-menu-popover-fixed"
          style={{ top: `${openRowMenuPos.top}px`, left: `${openRowMenuPos.left}px` }}
        >
          {openRowMenuContext.linkedEmployee ? (
            <button
              type="button"
              className="sv-row-menu-item"
              onClick={() => {
                const employeeId = openRowMenuContext.linkedEmployee._id;
                setOpenRowMenuId('');
                setOpenRowMenuContext(null);
                navigate(ROUTES.employeeDetail.replace(':employeeId', employeeId));
              }}
            >
              <Icon name="open_in_new" className="sv-icon-btn-icon" />
              <span>Open Employee</span>
            </button>
          ) : null}
          <button
            type="button"
            className="sv-row-menu-item"
            onClick={() => {
              const targetContact = openRowMenuContext.contact;
              setOpenRowMenuId('');
              setOpenRowMenuContext(null);
              openEdit(targetContact);
            }}
          >
            <Icon name="edit" className="sv-icon-btn-icon" />
            <span>Edit</span>
          </button>
          <button
            type="button"
            className="sv-row-menu-item is-danger"
            onClick={() => {
              const targetId = String(openRowMenuContext.contact._id || '');
              setOpenRowMenuId('');
              setOpenRowMenuContext(null);
              setDeleteId(targetId);
            }}
          >
            <Icon name="delete" className="sv-icon-btn-icon" />
            <span>Delete</span>
          </button>
        </div>
      ) : null}

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
        <div className="sv-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="sv-card w-full max-w-md p-5">
            <h3 className="text-lg font-semibold text-on-surface">Delete Contact?</h3>
            <p className="mt-2 text-sm text-on-surface-variant">This will remove the contact and clear linked employee references.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setDeleteId('')} className="sv-ctl-btn btn-light sv-icon-btn">
                <Icon name="close" className="sv-icon-btn-icon" />
                <span>Cancel</span>
              </button>
              <button type="button" onClick={onDelete} className="sv-ctl-btn btn-danger sv-icon-btn">
                <Icon name="delete" className="sv-icon-btn-icon" />
                <span>{busy ? 'Deleting...' : 'Delete'}</span>
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

export default ContactsPage;

import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useEmployeeProfile } from '../../hooks/useEmployeeProfile';
import { useEmployeeTimeLogs } from '../../hooks/useEmployeeTimeLogs';
import { useContacts } from '../../hooks/useContacts';
import { useEmployees } from '../../hooks/useEmployees';
import { useTeams } from '../../hooks/useTeams';
import { useWorkspace } from '../../contexts/WorkspaceContext';
import { employeesApi } from '../../api';
import { ROUTES } from '../../routes/routePaths';
import Icon from '../../components/ui/Icon';
import SelectDropdown from '../../components/ui/SelectDropdown';

const EMPLOYEE_STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'archived', label: 'Archived' },
];
const AVAILABILITY_OPTIONS = [
  { value: 'available', label: 'Available' },
  { value: 'busy', label: 'Busy' },
  { value: 'ooo', label: 'Out Of Office' },
  { value: 'leave', label: 'Leave' },
];

function EmployeeDetailPage() {
  const navigate = useNavigate();
  const { employeeId } = useParams();
  const { workspaceId } = useWorkspace();
  const { profile, performance, timeline, loading, error, refresh } = useEmployeeProfile(employeeId);
  const { items: timeLogs, summary } = useEmployeeTimeLogs(employeeId);
  const { items: contacts } = useContacts();
  const { items: employees } = useEmployees();
  const { teams, createTeam } = useTeams();

  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    role: '',
    designation: '',
    department: '',
    phone: '',
    bio: '',
    team: '',
    employeeCode: '',
    status: 'active',
    availabilityStatus: 'available',
    hoursPerWeek: 40,
    velocity: 0,
    managerId: '',
    managerName: '',
    contactId: '',
  });

  const linkedContact = useMemo(
    () =>
      contacts.find(
        (contact) =>
          String(contact._id) === String(profile?.contactId || '') ||
          String(contact.employeeId || '') === String(profile?._id || ''),
      ),
    [contacts, profile?.contactId, profile?._id],
  );

  const managerOptions = useMemo(
    () => (employees || []).filter((employee) => String(employee._id) !== String(employeeId || '')),
    [employees, employeeId],
  );

  const activityRows = useMemo(() => timeline || [], [timeline]);

  const openModal = () => {
    if (!profile) return;
    setForm({
      name: profile.name || '',
      email: profile.email || '',
      role: profile.role || '',
      designation: profile.designation || '',
      department: profile.department || '',
      phone: profile.phone || '',
      bio: profile.bio || '',
      team: profile.team || '',
      employeeCode: profile.employeeCode || '',
      status: profile.status || 'active',
      availabilityStatus: profile.availability?.status || 'available',
      hoursPerWeek: Number(profile.capacity?.hoursPerWeek || 40),
      velocity: Number(profile.velocity || 0),
      managerId: profile.manager?.id || '',
      managerName: profile.manager?.name || '',
      contactId: profile.contactId || '',
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
  };

  const saveProfile = async (event) => {
    event.preventDefault();
    if (!workspaceId || !employeeId) return;

    const payload = {
      name: String(form.name || '').trim(),
      email: String(form.email || '').trim().toLowerCase(),
      role: String(form.role || '').trim(),
      designation: String(form.designation || '').trim(),
      department: String(form.department || '').trim(),
      phone: String(form.phone || '').trim(),
      bio: String(form.bio || '').trim(),
      team: String(form.team || '').trim(),
      employeeCode: String(form.employeeCode || '').trim(),
      status: form.status || 'active',
      availability: { status: form.availabilityStatus || 'available' },
      capacity: { hoursPerWeek: Math.max(1, Number(form.hoursPerWeek || 40)) },
      velocity: Math.max(0, Number(form.velocity || 0)),
      manager: form.managerId ? { id: form.managerId, name: form.managerName || '' } : { id: null, name: '' },
      contactId: form.contactId || null,
    };

    if (!payload.name) {
      setToast('Name is required');
      return;
    }

    setSaving(true);
    try {
      await employeesApi.update(workspaceId, employeeId, payload);
      await refresh({ silent: true });
      setToast('Employee updated');
      closeModal();
      setTimeout(() => setToast(''), 2500);
    } catch (nextError) {
      setToast(nextError.message || 'Failed to update employee');
      setTimeout(() => setToast(''), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handleCreateTeam = async () => {
    const name = window.prompt('Enter team name');
    if (!name || !String(name).trim()) return;
    try {
      const created = await createTeam({ name: String(name).trim() });
      if (created?.name) {
        setForm((current) => ({ ...current, team: created.name }));
      }
      setToast('Team created');
      setTimeout(() => setToast(''), 2500);
    } catch (nextError) {
      setToast(nextError.message || 'Failed to create team');
      setTimeout(() => setToast(''), 3000);
    }
  };

  return (
    <main className="sv-employee-detail-page min-h-screen">
      <div className="sv-employee-detail-stack">
        {loading ? <p className="text-sm text-on-surface-variant">Loading employee...</p> : null}
        {error ? <p className="text-sm text-error">{error}</p> : null}

        {profile ? (
          <>
            <section className="sv-card sv-employee-detail-hero">
              <div className="sv-employee-detail-hero-row">
                <div className="sv-employee-detail-identity">
                  <span className="sv-employee-detail-avatar">
                    {String(profile.name || 'EM').slice(0, 2).toUpperCase()}
                  </span>
                  <div className="sv-employee-detail-meta">
                    <h1 className="sv-employee-detail-name">{profile.name}</h1>
                    <p className="sv-employee-detail-role">{profile.designation || profile.role || 'Employee'}</p>
                    <p className="sv-employee-detail-email">{profile.email || '-'}</p>
                  </div>
                </div>
                <div className="sv-employee-detail-hero-actions">
                  <button type="button" onClick={openModal} className="sv-ctl-btn btn-primary sv-icon-btn">
                    <Icon name="edit" className="sv-icon-btn-icon" />
                    <span>Edit Profile</span>
                  </button>
                </div>
              </div>
            </section>

            <section className="sv-employee-detail-kpis">
              <article className="sv-card sv-employee-detail-kpi-card">
                <p className="sv-employee-detail-kpi-label">Completed</p>
                <p className="sv-employee-detail-kpi-value">{performance?.tasksCompleted || 0}</p>
              </article>
              <article className="sv-card sv-employee-detail-kpi-card">
                <p className="sv-employee-detail-kpi-label">Overdue</p>
                <p className="sv-employee-detail-kpi-value">{performance?.tasksOverdue || 0}</p>
              </article>
              <article className="sv-card sv-employee-detail-kpi-card">
                <p className="sv-employee-detail-kpi-label">On-Time Rate</p>
                <p className="sv-employee-detail-kpi-value">{performance?.onTimeDeliveryRate || 0}%</p>
              </article>
              <article className="sv-card sv-employee-detail-kpi-card">
                <p className="sv-employee-detail-kpi-label">Time Logged</p>
                <p className="sv-employee-detail-kpi-value">{Math.round((performance?.totalTimeLogged || 0) * 10) / 10}h</p>
              </article>
            </section>

            <section className="sv-employee-detail-grid sv-employee-detail-grid-top">
              <article className="sv-card sv-employee-detail-card">
                <h2 className="sv-employee-detail-card-title">Linked Contact</h2>
                {linkedContact ? (
                  <div className="sv-employee-detail-list">
                    <p className="sv-employee-detail-item-title">{linkedContact.name || 'Unnamed'}</p>
                    <p className="sv-employee-detail-item-meta">{linkedContact.email || '-'}</p>
                    <p className="sv-employee-detail-item-meta">{linkedContact.phone || '-'}</p>
                    <button
                      type="button"
                      onClick={() => navigate(`${ROUTES.contacts}?employeeId=${profile._id}`)}
                      className="mt-2 sv-ctl-btn btn-light sv-icon-btn"
                    >
                      <Icon name="contacts" className="sv-icon-btn-icon" />
                      <span>Open in Contacts</span>
                    </button>
                  </div>
                ) : (
                  <p className="sv-employee-detail-empty">No contact linked.</p>
                )}
              </article>

              <article className="sv-card sv-employee-detail-card sv-employee-detail-card-wide">
                <h2 className="sv-employee-detail-card-title">Time Logs</h2>
                <p className="sv-employee-detail-item-meta">Total: {summary.totalMins || 0} mins ({summary.count || 0} entries)</p>
                <div className="sv-employee-detail-list sv-employee-detail-scroll sv-employee-detail-scroll-logs">
                  {timeLogs.map((log) => (
                    <p key={log._id} className="sv-employee-detail-item-meta">
                      {new Date(log.loggedAt || log.createdAt).toLocaleString()} - {log.durationMins || 0} mins
                    </p>
                  ))}
                  {!timeLogs.length ? <p className="sv-employee-detail-empty">No time logs.</p> : null}
                </div>
              </article>
            </section>

            <section className="sv-employee-detail-grid sv-employee-detail-grid-bottom">
              <article className="sv-card sv-employee-detail-card">
                <h2 className="sv-employee-detail-card-title">Activity</h2>
                <div className="sv-employee-detail-list sv-employee-detail-scroll sv-employee-detail-scroll-activity">
                  {activityRows.map((item, index) => (
                    <p key={item._id || index} className="sv-employee-detail-item-meta">{item.message || `${item.action || 'updated'} ${item.entity || 'item'}`}</p>
                  ))}
                  {!activityRows.length ? <p className="sv-employee-detail-empty">No activity.</p> : null}
                </div>
              </article>

              <article className="sv-card sv-employee-detail-card">
                <h2 className="sv-employee-detail-card-title">Organization</h2>
                <div className="sv-employee-detail-list">
                  <p className="sv-employee-detail-item-meta">Team: {profile.team || '-'}</p>
                  <p className="sv-employee-detail-item-meta">Manager: {profile.manager?.name || '-'}</p>
                  <p className="sv-employee-detail-item-meta">Status: {profile.status || '-'}</p>
                  <p className="sv-employee-detail-item-meta">Availability: {profile.availability?.status || '-'}</p>
                  <p className="sv-employee-detail-item-meta">Capacity: {profile.capacity?.hoursPerWeek || 0} hours/week</p>
                </div>
              </article>
            </section>
          </>
        ) : null}
      </div>

      {modalOpen ? (
        <div className="sv-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="sv-card sv-employees-modal">
            <div className="sv-employees-modal-head">
              <h3 className="sv-employees-modal-title">Edit Employee Profile</h3>
              <button type="button" onClick={closeModal} className="sv-modal-close-btn" aria-label="Close">
                <Icon name="close" className="text-lg" />
              </button>
            </div>

            <form onSubmit={saveProfile} className="sv-employees-modal-form">
              <input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Name *" className="sv-ctl-input sv-employees-field" required />
              <input value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} placeholder="Email" className="sv-ctl-input sv-employees-field" />
              <input value={form.role} onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))} placeholder="Role" className="sv-ctl-input sv-employees-field" />
              <input value={form.designation} onChange={(e) => setForm((prev) => ({ ...prev, designation: e.target.value }))} placeholder="Designation" className="sv-ctl-input sv-employees-field" />
              <input value={form.department} onChange={(e) => setForm((prev) => ({ ...prev, department: e.target.value }))} placeholder="Department" className="sv-ctl-input sv-employees-field" />
              <input value={form.phone} onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))} placeholder="Phone" className="sv-ctl-input sv-employees-field" />

              <div className="sv-employees-team-row">
                <input value={form.team} onChange={(e) => setForm((prev) => ({ ...prev, team: e.target.value }))} list="team-options" placeholder="Team" className="sv-ctl-input sv-employees-field" />
                <button
                  type="button"
                  onClick={handleCreateTeam}
                  className="sv-ctl-btn btn-light sv-icon-btn"
                >
                  <Icon name="group_add" className="sv-icon-btn-icon" />
                  <span>New Team</span>
                </button>
              </div>
              <datalist id="team-options">
                {teams.map((team) => (
                  <option key={team._id} value={team.name || ''} />
                ))}
              </datalist>

              <input value={form.employeeCode} onChange={(e) => setForm((prev) => ({ ...prev, employeeCode: e.target.value }))} placeholder="Employee Code" className="sv-ctl-input sv-employees-field" />

              <SelectDropdown value={form.status} onChange={(nextValue) => setForm((prev) => ({ ...prev, status: nextValue }))} options={EMPLOYEE_STATUS_OPTIONS} triggerClassName="sv-employees-field" />

              <SelectDropdown value={form.availabilityStatus} onChange={(nextValue) => setForm((prev) => ({ ...prev, availabilityStatus: nextValue }))} options={AVAILABILITY_OPTIONS} triggerClassName="sv-employees-field" />

              <input type="number" min="1" value={form.hoursPerWeek} onChange={(e) => setForm((prev) => ({ ...prev, hoursPerWeek: e.target.value }))} placeholder="Hours per week" className="sv-ctl-input sv-employees-field" />
              <input type="number" min="0" value={form.velocity} onChange={(e) => setForm((prev) => ({ ...prev, velocity: e.target.value }))} placeholder="Velocity" className="sv-ctl-input sv-employees-field" />

              <SelectDropdown
                value={form.managerId}
                onChange={(managerId) => {
                  const manager = managerOptions.find((item) => String(item._id) === String(managerId));
                  setForm((prev) => ({ ...prev, managerId, managerName: manager?.name || '' }));
                }}
                options={[
                  { value: '', label: 'No manager' },
                  ...managerOptions.map((employee) => ({ value: employee._id, label: employee.name || 'Unnamed' })),
                ]}
                triggerClassName="sv-employees-field"
              />

              <SelectDropdown
                value={form.contactId}
                onChange={(nextValue) => setForm((prev) => ({ ...prev, contactId: nextValue }))}
                options={[
                  { value: '', label: 'No linked contact' },
                  ...contacts.map((contact) => ({
                    value: contact._id,
                    label: `${contact.name || 'Unnamed'}${contact.email ? ` (${contact.email})` : ''}`,
                  })),
                ]}
                triggerClassName="sv-employees-field"
              />

              <textarea value={form.bio} onChange={(e) => setForm((prev) => ({ ...prev, bio: e.target.value }))} placeholder="Bio" className="md:col-span-2 sv-ctl-input sv-employees-field" rows={3} />

              <div className="md:col-span-2 sv-employees-modal-actions">
                <button type="button" onClick={closeModal} className="sv-ctl-btn btn-light sv-icon-btn">
                  <Icon name="close" className="sv-icon-btn-icon" />
                  <span>Cancel</span>
                </button>
                <button type="submit" disabled={saving} className="sv-ctl-btn btn-primary sv-icon-btn">
                  <Icon name="save" className="sv-icon-btn-icon" />
                  <span>{saving ? 'Saving...' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className="fixed bottom-5 right-5 z-[60] rounded-lg bg-surface-container px-4 py-2 text-sm font-semibold text-on-surface shadow-lg">
          {toast}
        </div>
      ) : null}
    </main>
  );
}

export default EmployeeDetailPage;

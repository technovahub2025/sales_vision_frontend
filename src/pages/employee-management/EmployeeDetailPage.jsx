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
  const [modal, setModal] = useState('');
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

  const openModal = (mode) => {
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
    setModal(mode);
  };

  const closeModal = () => {
    if (saving) return;
    setModal('');
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
    <main className="min-h-screen">
      <div className="space-y-6">
        {loading ? <p className="text-sm text-on-surface-variant">Loading employee...</p> : null}
        {error ? <p className="text-sm text-error">{error}</p> : null}

        {profile ? (
          <>
            <section className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-center gap-4">
                  <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
                    {String(profile.name || 'EM').slice(0, 2).toUpperCase()}
                  </span>
                  <div>
                    <h1 className="text-2xl font-semibold text-gray-900">{profile.name}</h1>
                    <p className="text-sm text-on-surface-variant">{profile.designation || profile.role || 'Employee'}</p>
                    <p className="text-xs text-on-surface-variant">{profile.email || '-'}</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => openModal('core')} className="rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white">Edit Profile</button>
                  <button type="button" onClick={() => openModal('org')} className="rounded-lg border border-outline-variant px-3 py-2 text-sm font-semibold">Org Settings</button>
                </div>
              </div>
            </section>

            <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
              <article className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-4">
                <p className="text-xs uppercase text-on-surface-variant">Completed</p>
                <p className="text-2xl font-bold text-on-surface">{performance?.tasksCompleted || 0}</p>
              </article>
              <article className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-4">
                <p className="text-xs uppercase text-on-surface-variant">Overdue</p>
                <p className="text-2xl font-bold text-on-surface">{performance?.tasksOverdue || 0}</p>
              </article>
              <article className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-4">
                <p className="text-xs uppercase text-on-surface-variant">On-Time Rate</p>
                <p className="text-2xl font-bold text-on-surface">{performance?.onTimeDeliveryRate || 0}%</p>
              </article>
              <article className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-4">
                <p className="text-xs uppercase text-on-surface-variant">Time Logged</p>
                <p className="text-2xl font-bold text-on-surface">{Math.round((performance?.totalTimeLogged || 0) * 10) / 10}h</p>
              </article>
            </section>

            <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <article className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-4">
                <h2 className="mb-3 text-sm font-semibold text-on-surface">Linked Contact</h2>
                {linkedContact ? (
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-on-surface">{linkedContact.name || 'Unnamed'}</p>
                    <p className="text-xs text-on-surface-variant">{linkedContact.email || '-'}</p>
                    <p className="text-xs text-on-surface-variant">{linkedContact.phone || '-'}</p>
                    <button
                      type="button"
                      onClick={() => navigate(`${ROUTES.contacts}?employeeId=${profile._id}`)}
                      className="mt-2 rounded bg-surface-container px-3 py-1 text-xs font-semibold"
                    >
                      Open in Contacts
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-on-surface-variant">No contact linked.</p>
                )}
              </article>

              <article className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-4 xl:col-span-2">
                <h2 className="mb-2 text-sm font-semibold text-on-surface">Time Logs</h2>
                <p className="mb-3 text-xs text-on-surface-variant">Total: {summary.totalMins || 0} mins ({summary.count || 0} entries)</p>
                <div className="space-y-2">
                  {timeLogs.slice(0, 8).map((log) => (
                    <p key={log._id} className="text-sm text-on-surface-variant">
                      {new Date(log.loggedAt || log.createdAt).toLocaleString()} - {log.durationMins || 0} mins
                    </p>
                  ))}
                  {!timeLogs.length ? <p className="text-sm text-on-surface-variant">No time logs.</p> : null}
                </div>
              </article>
            </section>

            <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
              <article className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-4">
                <h2 className="mb-2 text-sm font-semibold text-on-surface">Activity</h2>
                <div className="space-y-2">
                  {activityRows.slice(0, 20).map((item, index) => (
                    <p key={item._id || index} className="text-sm text-on-surface-variant">{item.message || `${item.action || 'updated'} ${item.entity || 'item'}`}</p>
                  ))}
                  {!activityRows.length ? <p className="text-sm text-on-surface-variant">No activity.</p> : null}
                </div>
              </article>

              <article className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-4">
                <h2 className="mb-2 text-sm font-semibold text-on-surface">Organization</h2>
                <div className="space-y-2 text-sm text-on-surface-variant">
                  <p>Team: {profile.team || '-'}</p>
                  <p>Manager: {profile.manager?.name || '-'}</p>
                  <p>Status: {profile.status || '-'}</p>
                  <p>Availability: {profile.availability?.status || '-'}</p>
                  <p>Capacity: {profile.capacity?.hoursPerWeek || 0} hours/week</p>
                </div>
              </article>
            </section>
          </>
        ) : null}
      </div>

      {modal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4">
          <div className="w-full max-w-3xl rounded-2xl bg-surface-container-lowest p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-on-surface">{modal === 'core' ? 'Edit Employee Profile' : 'Edit Organization Settings'}</h3>
              <button type="button" onClick={closeModal} className="rounded-lg p-2 text-on-surface-variant hover:bg-surface-container">
                <Icon name="close" className="text-lg" />
              </button>
            </div>

            <form onSubmit={saveProfile} className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Name *" className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm" required />
              <input value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} placeholder="Email" className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm" />
              <input value={form.role} onChange={(e) => setForm((prev) => ({ ...prev, role: e.target.value }))} placeholder="Role" className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm" />
              <input value={form.designation} onChange={(e) => setForm((prev) => ({ ...prev, designation: e.target.value }))} placeholder="Designation" className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm" />
              <input value={form.department} onChange={(e) => setForm((prev) => ({ ...prev, department: e.target.value }))} placeholder="Department" className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm" />
              <input value={form.phone} onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))} placeholder="Phone" className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm" />

              <div className="flex items-center gap-2">
                <input value={form.team} onChange={(e) => setForm((prev) => ({ ...prev, team: e.target.value }))} list="team-options" placeholder="Team" className="w-full rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm" />
                <button
                  type="button"
                  onClick={handleCreateTeam}
                  className="whitespace-nowrap rounded-lg border border-outline-variant px-3 py-2 text-xs font-semibold"
                >
                  New Team
                </button>
              </div>
              <datalist id="team-options">
                {teams.map((team) => (
                  <option key={team._id} value={team.name || ''} />
                ))}
              </datalist>

              <input value={form.employeeCode} onChange={(e) => setForm((prev) => ({ ...prev, employeeCode: e.target.value }))} placeholder="Employee Code" className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm" />

              <select value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))} className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="archived">Archived</option>
              </select>

              <select value={form.availabilityStatus} onChange={(e) => setForm((prev) => ({ ...prev, availabilityStatus: e.target.value }))} className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm">
                <option value="available">Available</option>
                <option value="busy">Busy</option>
                <option value="ooo">Out Of Office</option>
                <option value="leave">Leave</option>
              </select>

              <input type="number" min="1" value={form.hoursPerWeek} onChange={(e) => setForm((prev) => ({ ...prev, hoursPerWeek: e.target.value }))} placeholder="Hours per week" className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm" />
              <input type="number" min="0" value={form.velocity} onChange={(e) => setForm((prev) => ({ ...prev, velocity: e.target.value }))} placeholder="Velocity" className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm" />

              <select
                value={form.managerId}
                onChange={(e) => {
                  const managerId = e.target.value;
                  const manager = managerOptions.find((item) => String(item._id) === String(managerId));
                  setForm((prev) => ({ ...prev, managerId, managerName: manager?.name || '' }));
                }}
                className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm"
              >
                <option value="">No manager</option>
                {managerOptions.map((employee) => (
                  <option key={employee._id} value={employee._id}>{employee.name || 'Unnamed'}</option>
                ))}
              </select>

              <select value={form.contactId} onChange={(e) => setForm((prev) => ({ ...prev, contactId: e.target.value }))} className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm">
                <option value="">No linked contact</option>
                {contacts.map((contact) => (
                  <option key={contact._id} value={contact._id}>{contact.name || 'Unnamed'}{contact.email ? ` (${contact.email})` : ''}</option>
                ))}
              </select>

              <textarea value={form.bio} onChange={(e) => setForm((prev) => ({ ...prev, bio: e.target.value }))} placeholder="Bio" className="md:col-span-2 rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm" rows={3} />

              <div className="md:col-span-2 flex justify-end gap-2">
                <button type="button" onClick={closeModal} className="rounded-lg border border-outline-variant px-4 py-2 text-sm font-semibold">Cancel</button>
                <button type="submit" disabled={saving} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                  {saving ? 'Saving...' : 'Save Changes'}
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

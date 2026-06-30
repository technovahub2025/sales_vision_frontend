import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useProjectMembers } from '../../hooks/useProjectMembers';
import { useProjectRouteSync } from '../../hooks/useProjectRouteSync';
import ProjectTabs from './ProjectTabs';
import SelectDropdown from '../../components/ui/SelectDropdown';
import Icon from '../../components/ui/Icon';
import DeniedActionButton from '../../components/ui/DeniedActionButton';
import { usePermission } from '../../hooks/usePermission';

const addMemberSchema = z.object({
  userId: z.string().min(1, 'Select a user'),
  role: z.enum(['lead', 'member', 'viewer']),
});

const inviteSchema = z.object({
  email: z.string().trim().email('Enter a valid email'),
  role: z.enum(['admin', 'member', 'viewer']),
});

function RoleBadge({ role }) {
  const normalized = String(role || 'member').toLowerCase();
  return <span className={`sv-members-role-badge is-${normalized}`}>{normalized}</span>;
}

function projectMemberTimestamp(item) {
  const value = item?.updatedAt || item?.createdAt || item?.joinedAt || item?.invitedAt;
  const parsed = value ? new Date(value).getTime() : 0;
  return Number.isNaN(parsed) ? 0 : parsed;
}

function percent(done, total) {
  const value = total ? (Number(done || 0) / Number(total || 0)) * 100 : 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function ProjectMembersPage() {
  const projectId = useProjectRouteSync();
  const { can, role } = usePermission();
  const canManageMembers = can('workspace', 'manageMembers');
  const {
    members,
    pendingInvites,
    availableUsers,
    loading,
    invitesLoading,
    error,
    inviteError,
    addMember,
    updateRole,
    removeMember,
    createInvite,
    revokeInvite,
    addMemberState,
    updateRoleState,
    removeMemberState,
    createInviteState,
    revokeInviteState,
  } = useProjectMembers(projectId);

  const addMemberForm = useForm({
    resolver: zodResolver(addMemberSchema),
    defaultValues: { userId: '', role: 'member' },
  });

  const inviteForm = useForm({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: '', role: 'member' },
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [viewFilter, setViewFilter] = useState('members');
  const [roleFilter, setRoleFilter] = useState('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addMode, setAddMode] = useState('existing');

  const isMembersView = viewFilter === 'members';

  const rows = useMemo(() => members || [], [members]);
  const filteredRows = useMemo(() => {
    const query = String(searchQuery || '').trim().toLowerCase();
    const normalizedRole = String(roleFilter || 'all').toLowerCase();
    return rows.filter((member) => {
      const role = String(member.role || 'member').toLowerCase();
      if (normalizedRole !== 'all' && role !== normalizedRole) return false;
      if (!query) return true;
      const haystack = `${member.name || ''} ${member.email || ''} ${role}`.toLowerCase();
      return haystack.includes(query);
    }).sort((a, b) => projectMemberTimestamp(b) - projectMemberTimestamp(a));
  }, [rows, searchQuery, roleFilter]);

  const filteredInvites = useMemo(() => {
    const query = String(searchQuery || '').trim().toLowerCase();
    const normalizedRole = String(roleFilter || 'all').toLowerCase();
    return (pendingInvites || []).filter((invite) => {
      const role = String(invite.role || 'member').toLowerCase();
      if (normalizedRole !== 'all' && role !== normalizedRole) return false;
      if (!query) return true;
      return String(invite.email || '').toLowerCase().includes(query);
    }).sort((a, b) => projectMemberTimestamp(b) - projectMemberTimestamp(a));
  }, [pendingInvites, searchQuery, roleFilter]);

  const roleOptions = isMembersView
    ? [
      { value: 'all', label: 'All Roles' },
      { value: 'lead', label: 'Lead' },
      { value: 'member', label: 'Member' },
      { value: 'viewer', label: 'Viewer' },
    ]
    : [
      { value: 'all', label: 'All Invite Roles' },
      { value: 'admin', label: 'Admin' },
      { value: 'member', label: 'Member' },
      { value: 'viewer', label: 'Viewer' },
    ];
  const leadCount = rows.filter((member) => String(member.role || '').toLowerCase() === 'lead').length;
  const assignedTotal = rows.reduce((sum, member) => sum + Number(member.tasksInProject || 0), 0);
  const completedTotal = rows.reduce((sum, member) => sum + Number(member.completedInProject || 0), 0);
  const completionRate = percent(completedTotal, assignedTotal);
  const visibleCount = isMembersView ? filteredRows.length : filteredInvites.length;

  async function submitAddMember(values) {
    if (!canManageMembers) return;
    await addMember(values);
    addMemberForm.reset({ userId: '', role: values.role });
    setIsAddModalOpen(false);
  }

  async function submitInvite(values) {
    if (!canManageMembers) return;
    await createInvite(values);
    inviteForm.reset({ email: '', role: values.role });
    setIsAddModalOpen(false);
  }

  function openAddModal() {
    if (!canManageMembers) return;
    setAddMode('existing');
    setIsAddModalOpen(true);
  }

  function closeAddModal() {
    if (addMemberState.isPending || createInviteState.isPending) return;
    setIsAddModalOpen(false);
  }

  function formatDate(value) {
    if (!value) return 'N/A';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'N/A';
    return parsed.toLocaleString();
  }

  return (
    <main className="sv-members-page">
      <ProjectTabs projectId={projectId} />
      <div className="sv-members-stack">
        <section className="sv-card sv-members-header">
          <div className="sv-members-hero-copy">
            <span className="sv-members-eyebrow">Access and ownership</span>
            <h1 className="sv-members-title">Project Members</h1>
            <p className="sv-members-subtitle">Manage who can collaborate on this project, track contribution, and follow pending invites.</p>
          </div>
          <div className="sv-members-controls">
            <div className="sv-members-search-wrap">
              <Icon name="search" className="sv-members-search-icon" />
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={isMembersView ? 'Search members...' : 'Search pending invites...'}
                className="form-control form-control-sm sv-ctl-input sv-members-search"
              />
            </div>
            <SelectDropdown
              value={viewFilter}
              onChange={(nextValue) => {
                setViewFilter(nextValue);
                setRoleFilter('all');
              }}
              options={[
                { value: 'members', label: 'Members' },
                { value: 'pending', label: 'Pending Invites' },
              ]}
              className="sv-members-filter"
            />
            <SelectDropdown
              value={roleFilter}
              onChange={setRoleFilter}
              options={roleOptions}
              className="sv-members-filter"
            />
            {canManageMembers ? (
              <button type="button" className="btn btn-primary btn-sm sv-ctl-btn sv-members-add-btn" onClick={openAddModal}>
                Add User
              </button>
            ) : (
              <DeniedActionButton role={role} actionLabel="manage project members" className="btn btn-primary btn-sm sv-ctl-btn sv-members-add-btn">
                Add User
              </DeniedActionButton>
            )}
          </div>
        </section>

        <section className="sv-members-stats" aria-label="Project member summary">
          <article className="sv-card sv-members-stat-card">
            <span>Total members</span>
            <strong>{rows.length}</strong>
          </article>
          <article className="sv-card sv-members-stat-card">
            <span>Project leads</span>
            <strong>{leadCount}</strong>
          </article>
          <article className="sv-card sv-members-stat-card">
            <span>Pending invites</span>
            <strong>{pendingInvites.length}</strong>
          </article>
          <article className="sv-card sv-members-stat-card">
            <span>Completion</span>
            <strong>{completionRate}%</strong>
          </article>
        </section>

        {isMembersView && loading ? <p className="sv-members-message">Loading members...</p> : null}
        {isMembersView && error ? <p className="sv-members-message is-error">{error}</p> : null}
        {!isMembersView && invitesLoading ? <p className="sv-members-message">Loading invites...</p> : null}
        {!isMembersView && inviteError ? <p className="sv-members-message is-error">{inviteError}</p> : null}

        <section className="sv-card sv-members-table-card">
          <div className="sv-members-list-head">
            <div>
              <h2>{isMembersView ? 'Active collaborators' : 'Pending invitations'}</h2>
              <p>{visibleCount} visible {isMembersView ? 'member' : 'invite'}{visibleCount === 1 ? '' : 's'}</p>
            </div>
            <span>{isMembersView ? `${assignedTotal} assigned tasks` : `${pendingInvites.length} pending`}</span>
          </div>
          <div className="sv-members-card-grid sv-list-scroll">
            {isMembersView ? (
              <>
                {filteredRows.map((member) => {
                  const completion = percent(member.completedInProject, member.tasksInProject);
                  return (
                    <article key={member.userId} className="sv-members-person-card">
                      <div className="sv-members-person-top">
                        <div className="sv-members-member-cell">
                          <span className="sv-members-avatar">{String(member.name || 'U').slice(0, 1).toUpperCase()}</span>
                          <div>
                            <p className="sv-members-member-name">{member.name || 'Unknown'}</p>
                            <p className="sv-members-member-date">Joined {member.joinedAt ? new Date(member.joinedAt).toLocaleDateString() : 'N/A'}</p>
                          </div>
                        </div>
                        <RoleBadge role={member.role || 'member'} />
                      </div>
                      <div className="sv-members-card-metrics">
                        <span><strong>{member.tasksInProject || 0}</strong> assigned</span>
                        <span><strong>{member.completedInProject || 0}</strong> completed</span>
                        <span><strong>{completion}%</strong> done</span>
                      </div>
                      <div className="sv-members-progress"><span style={{ width: `${completion}%` }} /></div>
                      <div className="sv-members-card-actions">
                        {canManageMembers ? (
                          <SelectDropdown
                            value={member.role || 'member'}
                            onChange={(nextValue) => updateRole({ userId: member.userId, role: nextValue })}
                            options={[
                              { value: 'lead', label: 'Lead' },
                              { value: 'member', label: 'Member' },
                              { value: 'viewer', label: 'Viewer' },
                            ]}
                            className="sv-members-role-edit"
                            disabled={updateRoleState.isPending}
                          />
                        ) : null}
                        {canManageMembers ? (
                          <button type="button" className="btn btn-sm sv-ctl-btn sv-members-remove-btn" onClick={() => removeMember({ userId: member.userId })} disabled={removeMemberState.isPending}>
                            Remove
                          </button>
                        ) : (
                          <DeniedActionButton role={role} actionLabel="remove project members" className="btn btn-sm sv-ctl-btn sv-members-remove-btn">Remove</DeniedActionButton>
                        )}
                      </div>
                    </article>
                  );
                })}
                {!filteredRows.length && !loading ? <p className="sv-members-empty-cell">No members found for this project.</p> : null}
              </>
            ) : (
              <>
                {filteredInvites.map((invite) => (
                  <article key={invite._id || invite.id} className="sv-members-person-card sv-members-invite-card">
                    <div className="sv-members-person-top">
                      <div>
                        <p className="sv-members-invite-email">{invite.email || 'Unknown email'}</p>
                        <p className="sv-members-invite-date">Invited {formatDate(invite.createdAt || invite.invitedAt)}</p>
                      </div>
                      <RoleBadge role={invite.role || 'member'} />
                    </div>
                    <p className="sv-members-invite-date">Expires {formatDate(invite.expiresAt)}</p>
                    <div className="sv-members-card-actions is-end">
                      {canManageMembers ? (
                        <button type="button" className="btn btn-light btn-sm sv-ctl-btn sv-members-revoke-btn" onClick={() => revokeInvite({ inviteId: invite._id || invite.id })} disabled={revokeInviteState.isPending}>
                          Revoke
                        </button>
                      ) : (
                        <DeniedActionButton role={role} actionLabel="revoke project invites" className="btn btn-light btn-sm sv-ctl-btn sv-members-revoke-btn">Revoke</DeniedActionButton>
                      )}
                    </div>
                  </article>
                ))}
                {!filteredInvites.length && !invitesLoading ? <p className="sv-members-empty-cell">No pending invites.</p> : null}
              </>
            )}
          </div>
        </section>
      </div>

      {isAddModalOpen ? (
        <div
          className="sv-modal-backdrop fixed inset-0 z-50 d-flex align-items-center justify-content-center p-3"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeAddModal();
          }}
        >
          <div className="sv-card sv-modal-panel sv-members-modal" role="dialog" aria-modal="true" aria-label="Add project member">
            <div className="sv-members-modal-head">
              <h2 className="sv-members-form-title">Add User</h2>
              <button
                type="button"
                className="sv-modal-close-btn"
                onClick={closeAddModal}
                aria-label="Close add user modal"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="sv-members-modal-switch">
              <button
                type="button"
                className={`btn btn-sm sv-ctl-btn sv-members-mode-btn ${addMode === 'existing' ? 'is-active' : ''}`}
                onClick={() => setAddMode('existing')}
              >
                Existing User
              </button>
              <button
                type="button"
                className={`btn btn-sm sv-ctl-btn sv-members-mode-btn ${addMode === 'invite' ? 'is-active' : ''}`}
                onClick={() => setAddMode('invite')}
              >
                Invite by Email
              </button>
            </div>

            {addMode === 'existing' ? (
              <form className="sv-members-form" onSubmit={addMemberForm.handleSubmit(submitAddMember)}>
                <Controller
                  control={addMemberForm.control}
                  name="userId"
                  render={({ field }) => (
                    <SelectDropdown
                      value={field.value}
                      onChange={field.onChange}
                      options={[
                        { value: '', label: 'Select user' },
                        ...availableUsers.map((user) => ({
                          value: user._id,
                          label: `${user.displayName} (${user.role})`,
                        })),
                      ]}
                      className="sv-members-field"
                    />
                  )}
                />
                <p className="sv-members-field-error">{addMemberForm.formState.errors.userId?.message || ''}</p>
                <div className="sv-members-inline-actions">
                  <Controller
                    control={addMemberForm.control}
                    name="role"
                    render={({ field }) => (
                      <SelectDropdown
                        value={field.value}
                        onChange={field.onChange}
                        options={[
                          { value: 'lead', label: 'Lead' },
                          { value: 'member', label: 'Member' },
                          { value: 'viewer', label: 'Viewer' },
                        ]}
                        className="sv-members-role-select"
                      />
                    )}
                  />
                  <button type="submit" className="btn btn-primary btn-sm sv-ctl-btn sv-members-action-btn" disabled={addMemberState.isPending}>
                    {addMemberState.isPending ? 'Adding...' : 'Add Member'}
                  </button>
                </div>
              </form>
            ) : (
              <form className="sv-members-form" onSubmit={inviteForm.handleSubmit(submitInvite)}>
                <input className="form-control form-control-sm sv-ctl-input sv-members-field" placeholder="user@company.com" {...inviteForm.register('email')} />
                <p className="sv-members-field-error">{inviteForm.formState.errors.email?.message || inviteError || ''}</p>
                <div className="sv-members-inline-actions">
                  <Controller
                    control={inviteForm.control}
                    name="role"
                    render={({ field }) => (
                      <SelectDropdown
                        value={field.value}
                        onChange={field.onChange}
                        options={[
                          { value: 'admin', label: 'Admin' },
                          { value: 'member', label: 'Member' },
                          { value: 'viewer', label: 'Viewer' },
                        ]}
                        className="sv-members-role-select"
                      />
                    )}
                  />
                  <button type="submit" className="btn btn-primary btn-sm sv-ctl-btn sv-members-action-btn" disabled={createInviteState.isPending}>
                    {createInviteState.isPending ? 'Sending...' : 'Send Invite'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </main>
  );
}

export default ProjectMembersPage;


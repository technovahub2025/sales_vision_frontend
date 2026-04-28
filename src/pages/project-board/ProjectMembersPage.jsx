import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useProjectMembers } from '../../hooks/useProjectMembers';
import { useProjectRouteSync } from '../../hooks/useProjectRouteSync';
import ProjectTabs from './ProjectTabs';
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
    });
  }, [rows, searchQuery, roleFilter]);

  const filteredInvites = useMemo(() => {
    const query = String(searchQuery || '').trim().toLowerCase();
    const normalizedRole = String(roleFilter || 'all').toLowerCase();
    return (pendingInvites || []).filter((invite) => {
      const role = String(invite.role || 'member').toLowerCase();
      if (normalizedRole !== 'all' && role !== normalizedRole) return false;
      if (!query) return true;
      return String(invite.email || '').toLowerCase().includes(query);
    });
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
          <h1 className="sv-members-title">Project Members</h1>
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
            <select
              value={viewFilter}
              onChange={(event) => {
                setViewFilter(event.target.value);
                setRoleFilter('all');
              }}
              className="form-select form-select-sm sv-ctl-select sv-members-filter"
            >
              <option value="members">Members</option>
              <option value="pending">Pending Invites</option>
            </select>
            <select
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value)}
              className="form-select form-select-sm sv-ctl-select sv-members-filter"
            >
              {roleOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
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

        {isMembersView && loading ? <p className="sv-members-message">Loading members...</p> : null}
        {isMembersView && error ? <p className="sv-members-message is-error">{error}</p> : null}
        {!isMembersView && invitesLoading ? <p className="sv-members-message">Loading invites...</p> : null}
        {!isMembersView && inviteError ? <p className="sv-members-message is-error">{inviteError}</p> : null}

        <section className="sv-card sv-members-table-card">
          <div className="sv-members-table-wrap">
            <table className="sv-members-table">
              <thead>
                {isMembersView ? (
                  <tr>
                    <th>Member</th>
                    <th>Role</th>
                    <th className="sv-members-col-metric">Assigned</th>
                    <th className="sv-members-col-metric">Completed</th>
                    <th className="is-right">Actions</th>
                  </tr>
                ) : (
                  <tr>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Invited / Expires</th>
                    <th className="is-right">Actions</th>
                  </tr>
                )}
              </thead>
              {isMembersView ? (
                <tbody>
                  {filteredRows.map((member) => (
                    <tr key={member.userId}>
                      <td>
                        <div className="sv-members-member-cell">
                          <span className="sv-members-avatar">
                            {String(member.name || 'U').slice(0, 1).toUpperCase()}
                          </span>
                          <div>
                            <p className="sv-members-member-name">{member.name || 'Unknown'}</p>
                            <p className="sv-members-member-date">{member.joinedAt ? new Date(member.joinedAt).toLocaleDateString() : 'N/A'}</p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="sv-members-role-cell">
                          <RoleBadge role={member.role || 'member'} />
                          {canManageMembers ? (
                            <select
                              className="form-select form-select-sm sv-ctl-select sv-members-role-edit"
                              value={member.role || 'member'}
                              onChange={(event) => updateRole({ userId: member.userId, role: event.target.value })}
                              disabled={updateRoleState.isPending}
                            >
                              <option value="lead">Lead</option>
                              <option value="member">Member</option>
                              <option value="viewer">Viewer</option>
                            </select>
                          ) : null}
                        </div>
                      </td>
                      <td className="sv-members-col-metric">{member.tasksInProject || 0}</td>
                      <td className="sv-members-col-metric">{member.completedInProject || 0}</td>
                      <td className="is-right">
                        {canManageMembers ? (
                          <button
                            type="button"
                            className="btn btn-sm sv-ctl-btn sv-members-remove-btn"
                            onClick={() => removeMember({ userId: member.userId })}
                            disabled={removeMemberState.isPending}
                          >
                            Remove
                          </button>
                        ) : (
                          <DeniedActionButton role={role} actionLabel="remove project members" className="btn btn-sm sv-ctl-btn sv-members-remove-btn">
                            Remove
                          </DeniedActionButton>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!filteredRows.length && !loading ? (
                    <tr>
                      <td colSpan={5} className="sv-members-empty-cell">
                        No members found for this project.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              ) : (
                <tbody>
                  {filteredInvites.map((invite) => (
                    <tr key={invite._id || invite.id}>
                      <td>
                        <p className="sv-members-invite-email">{invite.email || 'Unknown email'}</p>
                      </td>
                      <td>
                        <RoleBadge role={invite.role || 'member'} />
                      </td>
                      <td>
                        <p className="sv-members-invite-date">Invited: {formatDate(invite.createdAt || invite.invitedAt)}</p>
                        <p className="sv-members-invite-date">Expires: {formatDate(invite.expiresAt)}</p>
                      </td>
                      <td className="is-right">
                        {canManageMembers ? (
                          <button
                            type="button"
                            className="btn btn-light btn-sm sv-ctl-btn sv-members-revoke-btn"
                            onClick={() => revokeInvite({ inviteId: invite._id || invite.id })}
                            disabled={revokeInviteState.isPending}
                          >
                            Revoke
                          </button>
                        ) : (
                          <DeniedActionButton role={role} actionLabel="revoke project invites" className="btn btn-light btn-sm sv-ctl-btn sv-members-revoke-btn">
                            Revoke
                          </DeniedActionButton>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!filteredInvites.length && !invitesLoading ? (
                    <tr>
                      <td colSpan={4} className="sv-members-empty-cell">
                        No pending invites.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              )}
            </table>
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
                <select className="form-select form-select-sm sv-ctl-select sv-members-field" {...addMemberForm.register('userId')}>
                  <option value="">Select user</option>
                  {availableUsers.map((user) => (
                    <option key={user._id} value={user._id}>{user.displayName} ({user.role})</option>
                  ))}
                </select>
                <p className="sv-members-field-error">{addMemberForm.formState.errors.userId?.message || ''}</p>
                <div className="sv-members-inline-actions">
                  <select className="form-select form-select-sm sv-ctl-select sv-members-role-select" {...addMemberForm.register('role')}>
                    <option value="lead">Lead</option>
                    <option value="member">Member</option>
                    <option value="viewer">Viewer</option>
                  </select>
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
                  <select className="form-select form-select-sm sv-ctl-select sv-members-role-select" {...inviteForm.register('role')}>
                    <option value="admin">Admin</option>
                    <option value="member">Member</option>
                    <option value="viewer">Viewer</option>
                  </select>
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


import { useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useProjectMembers } from '../../hooks/useProjectMembers';
import { useProjectRouteSync } from '../../hooks/useProjectRouteSync';
import ProjectTabs from './ProjectTabs';
import Icon from '../../components/ui/Icon';

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
  const [memberQuery, setMemberQuery] = useState('');
  const [memberRoleFilter, setMemberRoleFilter] = useState('all');
  const [inviteQuery, setInviteQuery] = useState('');
  const [inviteRoleFilter, setInviteRoleFilter] = useState('all');

  const rows = useMemo(() => members || [], [members]);
  const filteredRows = useMemo(() => {
    const query = String(memberQuery || '').trim().toLowerCase();
    const roleFilter = String(memberRoleFilter || 'all').toLowerCase();
    return rows.filter((member) => {
      const role = String(member.role || 'member').toLowerCase();
      if (roleFilter !== 'all' && role !== roleFilter) return false;
      if (!query) return true;
      const haystack = `${member.name || ''} ${member.email || ''} ${role}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [rows, memberQuery, memberRoleFilter]);
  const filteredInvites = useMemo(() => {
    const query = String(inviteQuery || '').trim().toLowerCase();
    const roleFilter = String(inviteRoleFilter || 'all').toLowerCase();
    return (pendingInvites || []).filter((invite) => {
      const role = String(invite.role || 'member').toLowerCase();
      if (roleFilter !== 'all' && role !== roleFilter) return false;
      if (!query) return true;
      return String(invite.email || '').toLowerCase().includes(query);
    });
  }, [pendingInvites, inviteQuery, inviteRoleFilter]);

  async function submitAddMember(values) {
    await addMember(values);
    addMemberForm.reset({ userId: '', role: values.role });
  }

  async function submitInvite(values) {
    await createInvite(values);
    inviteForm.reset({ email: '', role: values.role });
  }

  return (
    <main className="sv-members-page">
      <ProjectTabs projectId={projectId} />
      <div className="sv-members-stack">
        <section className="sv-card sv-members-header">
          <h1 className="sv-members-title">Project Members</h1>
        </section>

        <section className="sv-members-form-grid">
          <div className="sv-card sv-members-form-card">
            <form className="sv-members-form" onSubmit={addMemberForm.handleSubmit(submitAddMember)}>
              <h2 className="sv-members-form-title">Add Existing Workspace User</h2>
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
          </div>

          <div className="sv-card sv-members-form-card">
            <form className="sv-members-form" onSubmit={inviteForm.handleSubmit(submitInvite)}>
              <h2 className="sv-members-form-title">Invite by Email</h2>
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
          </div>
        </section>

        {loading ? <p className="sv-members-message">Loading members...</p> : null}
        {error ? <p className="sv-members-message is-error">{error}</p> : null}

        <section className="sv-card sv-members-table-card">
          <div className="sv-members-controls">
            <div className="sv-members-search-wrap">
              <Icon name="search" className="sv-members-search-icon" />
              <input
                type="text"
                value={memberQuery}
                onChange={(event) => setMemberQuery(event.target.value)}
                placeholder="Search members..."
                className="form-control form-control-sm sv-ctl-input sv-members-search"
              />
            </div>
            <select
              value={memberRoleFilter}
              onChange={(event) => setMemberRoleFilter(event.target.value)}
              className="form-select form-select-sm sv-ctl-select sv-members-filter"
            >
              <option value="all">All Roles</option>
              <option value="lead">Lead</option>
              <option value="member">Member</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>

          <div className="sv-members-table-wrap">
            <table className="sv-members-table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th>Role</th>
                  <th className="sv-members-col-metric">Assigned</th>
                  <th className="sv-members-col-metric">Completed</th>
                  <th className="is-right">Actions</th>
                </tr>
              </thead>
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
                      </div>
                    </td>
                    <td className="sv-members-col-metric">{member.tasksInProject || 0}</td>
                    <td className="sv-members-col-metric">{member.completedInProject || 0}</td>
                    <td className="is-right">
                      <button
                        type="button"
                        className="btn btn-sm sv-ctl-btn sv-members-remove-btn"
                        onClick={() => removeMember({ userId: member.userId })}
                        disabled={removeMemberState.isPending}
                      >
                        Remove
                      </button>
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
            </table>
          </div>
        </section>

        <section className="sv-card sv-members-invites-card">
          <div className="sv-members-invites-head">
            <h2 className="sv-members-form-title">Pending Invites</h2>
          </div>
          <div className="sv-members-controls">
            <div className="sv-members-search-wrap">
              <Icon name="search" className="sv-members-search-icon" />
              <input
                type="text"
                value={inviteQuery}
                onChange={(event) => setInviteQuery(event.target.value)}
                placeholder="Search invites..."
                className="form-control form-control-sm sv-ctl-input sv-members-search"
              />
            </div>
            <select
              value={inviteRoleFilter}
              onChange={(event) => setInviteRoleFilter(event.target.value)}
              className="form-select form-select-sm sv-ctl-select sv-members-filter"
            >
              <option value="all">All Invite Roles</option>
              <option value="admin">Admin</option>
              <option value="member">Member</option>
              <option value="viewer">Viewer</option>
            </select>
          </div>

          {invitesLoading ? <p className="sv-members-message">Loading invites...</p> : null}
          {!filteredInvites.length && !invitesLoading ? <p className="sv-members-message">No pending invites.</p> : null}
          <ul className="sv-members-invite-list">
            {filteredInvites.map((invite) => (
              <li key={invite._id || invite.id} className="sv-members-invite-item">
                <div>
                  <p className="sv-members-invite-email">{invite.email}</p>
                  <p className="sv-members-invite-meta">{invite.role} | expires {invite.expiresAt ? new Date(invite.expiresAt).toLocaleString() : 'N/A'}</p>
                </div>
                <button
                  type="button"
                  className="btn btn-light btn-sm sv-ctl-btn sv-members-revoke-btn"
                  onClick={() => revokeInvite({ inviteId: invite._id || invite.id })}
                  disabled={revokeInviteState.isPending}
                >
                  Revoke
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </main>
  );
}

export default ProjectMembersPage;


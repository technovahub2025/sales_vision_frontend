import { useState } from 'react';
import Icon from '../../components/ui/Icon';
import { useWorkspaceMembers } from '../../hooks/useWorkspaceMembers';
import SettingsTabs from './SettingsTabs';

const ROLE_OPTIONS = ['owner', 'admin', 'member', 'viewer'];

function SettingsMembersPage() {
  const {
    members,
    invites,
    loadingMembers,
    loadingInvites,
    membersError,
    invitesError,
    canManageMembers,
    inviteMember,
    revokeInvite,
    updateRole,
    removeMember,
    inviteState,
    updateRoleState,
    removeMemberState,
  } = useWorkspaceMembers();

  const [inviteForm, setInviteForm] = useState({ email: '', role: 'member' });
  const [actionError, setActionError] = useState('');

  const handleInvite = async (event) => {
    event.preventDefault();
    setActionError('');
    try {
      await inviteMember({
        email: inviteForm.email.trim(),
        role: inviteForm.role,
      });
      setInviteForm({ email: '', role: 'member' });
    } catch (error) {
      setActionError(error.message || 'Failed to invite member');
    }
  };

  const handleRoleChange = async (userId, role) => {
    setActionError('');
    try {
      await updateRole({ userId, role });
    } catch (error) {
      setActionError(error.message || 'Failed to update role');
    }
  };

  const handleRemoveMember = async (userId) => {
    if (!window.confirm('Remove this member from workspace?')) return;
    setActionError('');
    try {
      await removeMember(userId);
    } catch (error) {
      setActionError(error.message || 'Failed to remove member');
    }
  };

  const handleRevokeInvite = async (inviteId) => {
    setActionError('');
    try {
      await revokeInvite(inviteId);
    } catch (error) {
      setActionError(error.message || 'Failed to revoke invite');
    }
  };

  return (
    <main className="min-h-screen sv-settings-page">
      <div className="mx-auto max-w-6xl px-8 pb-12 pt-2 sv-settings-shell">
        <SettingsTabs />

        <section className="sv-settings-header">
          <h1 className="sv-settings-title">Workspace Members</h1>
          <p className="sv-settings-subtitle">Manage workspace access, roles, and pending invites.</p>
        </section>

        {membersError || invitesError || actionError ? (
          <div className="sv-settings-alert">
            {membersError || invitesError || actionError}
          </div>
        ) : null}

        <section className="sv-settings-card mb-8">
          <h2 className="sv-settings-card-title mb-4">Invite Member</h2>
          {!canManageMembers ? (
            <p className="sv-settings-note">Only Owner/Admin can invite members.</p>
          ) : (
            <form onSubmit={handleInvite} className="sv-settings-invite-form">
              <input
                type="email"
                required
                value={inviteForm.email}
                onChange={(event) => setInviteForm((prev) => ({ ...prev, email: event.target.value }))}
                placeholder="member@company.com"
                className="sv-settings-input"
              />
              <select
                value={inviteForm.role}
                onChange={(event) => setInviteForm((prev) => ({ ...prev, role: event.target.value }))}
                className="sv-settings-input capitalize"
              >
                {ROLE_OPTIONS.map((role) => (
                  <option key={role} value={role} className="capitalize">
                    {role}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={inviteState.isPending}
                className="sv-settings-btn sv-settings-btn-primary"
              >
                <Icon name="person_add" className="text-[1rem]" />
                {inviteState.isPending ? 'Inviting...' : 'Send Invite'}
              </button>
            </form>
          )}
        </section>

        <section className="sv-settings-card mb-8">
          <h2 className="sv-settings-card-title mb-4">Members</h2>
          {loadingMembers ? (
            <div className="space-y-3">
              <div className="h-10 animate-pulse rounded-lg bg-surface-container" />
              <div className="h-10 animate-pulse rounded-lg bg-surface-container" />
              <div className="h-10 animate-pulse rounded-lg bg-surface-container" />
            </div>
          ) : members.length ? (
            <div className="sv-settings-table-wrap">
              <table className="sv-settings-table">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Email</th>
                    <th>Role</th>
                    <th>Joined</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => (
                    <tr key={member.userId}>
                      <td className="text-sm font-medium text-on-surface">{member.name}</td>
                      <td className="text-sm text-on-surface-variant">{member.email}</td>
                      <td>
                        {canManageMembers ? (
                          <select
                            value={member.role}
                            onChange={(event) => handleRoleChange(member.userId, event.target.value)}
                            disabled={updateRoleState.isPending}
                            className="sv-settings-table-select capitalize"
                          >
                            {ROLE_OPTIONS.map((role) => (
                              <option key={role} value={role} className="capitalize">
                                {role}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className="inline-flex rounded-full bg-surface-container px-2 py-1 text-xs capitalize">{member.role}</span>
                        )}
                      </td>
                      <td className="text-xs text-on-surface-variant">
                        {member.joinedAt ? new Date(member.joinedAt).toLocaleDateString() : '-'}
                      </td>
                      <td className="text-right">
                        {canManageMembers ? (
                          <button
                            type="button"
                            onClick={() => handleRemoveMember(member.userId)}
                            disabled={removeMemberState.isPending}
                            className="sv-settings-btn sv-settings-btn-danger"
                          >
                            <Icon name="person_remove" className="text-[0.95rem]" />
                            Remove
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="sv-settings-note">No workspace members found.</p>
          )}
        </section>

        <section className="sv-settings-card">
          <h2 className="sv-settings-card-title mb-4">Pending Invites</h2>
          {loadingInvites ? (
            <div className="space-y-3">
              <div className="h-10 animate-pulse rounded-lg bg-surface-container" />
              <div className="h-10 animate-pulse rounded-lg bg-surface-container" />
            </div>
          ) : invites.length ? (
            <div className="space-y-2">
              {invites.map((invite) => (
                <div
                  key={invite._id || invite.id}
                  className="sv-settings-list-item flex flex-wrap items-center justify-between gap-3"
                >
                  <div>
                    <p className="text-sm font-medium text-on-surface">{invite.email}</p>
                    <p className="text-xs capitalize text-on-surface-variant">
                      {invite.role} - expires {invite.expiresAt ? new Date(invite.expiresAt).toLocaleString() : 'N/A'}
                    </p>
                  </div>
                  {canManageMembers ? (
                    <button
                      type="button"
                      onClick={() => handleRevokeInvite(invite._id || invite.id)}
                      className="sv-settings-btn sv-settings-btn-danger"
                    >
                      <Icon name="mail_off" className="text-[0.95rem]" />
                      Revoke
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="sv-settings-note">No pending invites.</p>
          )}
        </section>
      </div>
    </main>
  );
}

export default SettingsMembersPage;

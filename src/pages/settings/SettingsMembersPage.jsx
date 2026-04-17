import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useWorkspaceMembers } from '../../hooks/useWorkspaceMembers';
import { ROUTES } from '../../routes/routePaths';

const ROLE_OPTIONS = ['owner', 'admin', 'member', 'viewer'];

function tabClassName({ isActive }) {
  return `rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
    isActive ? 'bg-primary text-white' : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
  }`;
}

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
    <main className="min-h-screen">
      <div className="mx-auto max-w-6xl px-8 pb-12 pt-2">
        <div className="mb-6 flex items-center gap-3">
          <NavLink to={ROUTES.settings} end className={tabClassName}>
            General
          </NavLink>
          <NavLink to={ROUTES.settingsWorkspace} className={tabClassName}>
            Workspace
          </NavLink>
          <NavLink to={ROUTES.settingsMembers} className={tabClassName}>
            Members
          </NavLink>
          <NavLink to={ROUTES.settingsSecurity} className={tabClassName}>
            Security
          </NavLink>
        </div>

        <section className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight text-on-surface">Workspace Members</h1>
          <p className="mt-2 text-sm text-on-surface-variant">Manage workspace access, roles, and pending invites.</p>
        </section>

        {membersError || invitesError || actionError ? (
          <div className="mb-6 rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
            {membersError || invitesError || actionError}
          </div>
        ) : null}

        <section className="mb-8 rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-on-surface">Invite Member</h2>
          {!canManageMembers ? (
            <p className="text-sm text-on-surface-variant">Only Owner/Admin can invite members.</p>
          ) : (
            <form onSubmit={handleInvite} className="grid gap-3 sm:grid-cols-[1fr_180px_auto]">
              <input
                type="email"
                required
                value={inviteForm.email}
                onChange={(event) => setInviteForm((prev) => ({ ...prev, email: event.target.value }))}
                placeholder="member@company.com"
                className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm"
              />
              <select
                value={inviteForm.role}
                onChange={(event) => setInviteForm((prev) => ({ ...prev, role: event.target.value }))}
                className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm capitalize"
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
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {inviteState.isPending ? 'Inviting...' : 'Send Invite'}
              </button>
            </form>
          )}
        </section>

        <section className="mb-8 rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-on-surface">Members</h2>
          {loadingMembers ? (
            <div className="space-y-3">
              <div className="h-10 animate-pulse rounded-lg bg-surface-container" />
              <div className="h-10 animate-pulse rounded-lg bg-surface-container" />
              <div className="h-10 animate-pulse rounded-lg bg-surface-container" />
            </div>
          ) : members.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-outline-variant/20 text-xs uppercase tracking-wider text-on-surface-variant">
                    <th className="px-3 py-2">Member</th>
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2">Role</th>
                    <th className="px-3 py-2">Joined</th>
                    <th className="px-3 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((member) => (
                    <tr key={member.userId} className="border-b border-outline-variant/10">
                      <td className="px-3 py-3 text-sm font-medium text-on-surface">{member.name}</td>
                      <td className="px-3 py-3 text-sm text-on-surface-variant">{member.email}</td>
                      <td className="px-3 py-3">
                        {canManageMembers ? (
                          <select
                            value={member.role}
                            onChange={(event) => handleRoleChange(member.userId, event.target.value)}
                            disabled={updateRoleState.isPending}
                            className="rounded-md border border-outline-variant bg-surface px-2 py-1 text-xs capitalize"
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
                      <td className="px-3 py-3 text-xs text-on-surface-variant">
                        {member.joinedAt ? new Date(member.joinedAt).toLocaleDateString() : '-'}
                      </td>
                      <td className="px-3 py-3 text-right">
                        {canManageMembers ? (
                          <button
                            type="button"
                            onClick={() => handleRemoveMember(member.userId)}
                            disabled={removeMemberState.isPending}
                            className="text-xs font-semibold text-error hover:underline disabled:opacity-60"
                          >
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
            <p className="text-sm text-on-surface-variant">No workspace members found.</p>
          )}
        </section>

        <section className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-on-surface">Pending Invites</h2>
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
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-outline-variant/20 bg-surface px-3 py-2"
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
                      className="text-xs font-semibold text-error hover:underline"
                    >
                      Revoke
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-on-surface-variant">No pending invites.</p>
          )}
        </section>
      </div>
    </main>
  );
}

export default SettingsMembersPage;

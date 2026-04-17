import { useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useProjectMembers } from '../../hooks/useProjectMembers';
import { useProjectRouteSync } from '../../hooks/useProjectRouteSync';
import ProjectTabs from './ProjectTabs';

const addMemberSchema = z.object({
  userId: z.string().min(1, 'Select a user'),
  role: z.enum(['lead', 'member', 'viewer']),
});

const inviteSchema = z.object({
  email: z.string().trim().email('Enter a valid email'),
  role: z.enum(['admin', 'member', 'viewer']),
});

function RoleBadge({ role }) {
  const tone = role === 'lead' || role === 'admin' ? 'bg-indigo-100 text-indigo-700' : role === 'viewer' ? 'bg-slate-100 text-slate-700' : 'bg-blue-100 text-blue-700';
  return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${tone}`}>{role}</span>;
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

  const rows = useMemo(() => members || [], [members]);

  async function submitAddMember(values) {
    await addMember(values);
    addMemberForm.reset({ userId: '', role: values.role });
  }

  async function submitInvite(values) {
    await createInvite(values);
    inviteForm.reset({ email: '', role: values.role });
  }

  return (
    <main className="min-h-screen">
      <ProjectTabs projectId={projectId} />
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-on-surface">Project Members</h1>

        <section className="grid gap-4 rounded-xl border border-outline-variant bg-surface-container-lowest p-4 lg:grid-cols-2">
          <form className="space-y-3" onSubmit={addMemberForm.handleSubmit(submitAddMember)}>
            <h2 className="text-sm font-semibold text-on-surface">Add Existing Workspace User</h2>
            <select className="w-full rounded-lg border border-outline-variant px-3 py-2 text-sm" {...addMemberForm.register('userId')}>
              <option value="">Select user</option>
              {availableUsers.map((user) => (
                <option key={user._id} value={user._id}>{user.displayName} ({user.role})</option>
              ))}
            </select>
            <p className="text-xs text-error">{addMemberForm.formState.errors.userId?.message}</p>

            <div className="flex items-center gap-2">
              <select className="rounded-lg border border-outline-variant px-3 py-2 text-sm" {...addMemberForm.register('role')}>
                <option value="lead">Lead</option>
                <option value="member">Member</option>
                <option value="viewer">Viewer</option>
              </select>
              <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary" disabled={addMemberState.isPending}>
                {addMemberState.isPending ? 'Adding...' : 'Add Member'}
              </button>
            </div>
          </form>

          <form className="space-y-3" onSubmit={inviteForm.handleSubmit(submitInvite)}>
            <h2 className="text-sm font-semibold text-on-surface">Invite by Email</h2>
            <input className="w-full rounded-lg border border-outline-variant px-3 py-2 text-sm" placeholder="user@company.com" {...inviteForm.register('email')} />
            <p className="text-xs text-error">{inviteForm.formState.errors.email?.message}</p>
            {inviteError ? <p className="text-xs text-error">{inviteError}</p> : null}

            <div className="flex items-center gap-2">
              <select className="rounded-lg border border-outline-variant px-3 py-2 text-sm" {...inviteForm.register('role')}>
                <option value="admin">Admin</option>
                <option value="member">Member</option>
                <option value="viewer">Viewer</option>
              </select>
              <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-on-primary" disabled={createInviteState.isPending}>
                {createInviteState.isPending ? 'Sending...' : 'Send Invite'}
              </button>
            </div>
          </form>
        </section>

        {loading ? <p className="text-sm text-on-surface-variant">Loading members...</p> : null}
        {error ? <p className="text-sm text-error">{error}</p> : null}

        <section className="overflow-hidden rounded-xl border border-outline-variant bg-surface-container-lowest">
          <table className="min-w-full divide-y divide-outline-variant text-sm">
            <thead className="bg-surface-container-low">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Member</th>
                <th className="px-4 py-3 text-left font-semibold">Role</th>
                <th className="px-4 py-3 text-left font-semibold">Assigned</th>
                <th className="px-4 py-3 text-left font-semibold">Completed</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant bg-surface-container-lowest">
              {rows.map((member) => (
                <tr key={member.userId}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-surface-container text-xs font-bold">
                        {String(member.name || 'U').slice(0, 1).toUpperCase()}
                      </span>
                      <div>
                        <p className="font-semibold text-on-surface">{member.name || 'Unknown'}</p>
                        <p className="text-xs text-on-surface-variant">{member.joinedAt ? new Date(member.joinedAt).toLocaleDateString() : 'N/A'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <RoleBadge role={member.role || 'member'} />
                      <select
                        className="rounded-md border border-outline-variant px-2 py-1 text-xs"
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
                  <td className="px-4 py-3 text-on-surface-variant">{member.tasksInProject || 0}</td>
                  <td className="px-4 py-3 text-on-surface-variant">{member.completedInProject || 0}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      className="rounded-md border border-outline-variant px-3 py-1 text-xs font-semibold text-error"
                      onClick={() => removeMember({ userId: member.userId })}
                      disabled={removeMemberState.isPending}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
              {!rows.length && !loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-on-surface-variant">
                    No members found for this project.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </section>

        <section className="rounded-xl border border-outline-variant bg-surface-container-lowest p-4">
          <h2 className="mb-3 text-sm font-semibold text-on-surface">Pending Invites</h2>
          {invitesLoading ? <p className="text-sm text-on-surface-variant">Loading invites...</p> : null}
          {!pendingInvites.length && !invitesLoading ? <p className="text-sm text-on-surface-variant">No pending invites.</p> : null}
          <ul className="space-y-2">
            {pendingInvites.map((invite) => (
              <li key={invite._id || invite.id} className="flex items-center justify-between rounded-lg border border-outline-variant px-3 py-2 text-sm">
                <div>
                  <p className="font-medium text-on-surface">{invite.email}</p>
                  <p className="text-xs text-on-surface-variant">{invite.role} - expires {invite.expiresAt ? new Date(invite.expiresAt).toLocaleString() : 'N/A'}</p>
                </div>
                <button
                  type="button"
                  className="rounded-md border border-outline-variant px-3 py-1 text-xs font-semibold"
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


import { useEffect, useRef, useState } from 'react';
import Icon from '../../components/ui/Icon';
import DeniedActionButton from '../../components/ui/DeniedActionButton';
import SelectDropdown from '../../components/ui/SelectDropdown';
import { useWorkspaceMembers } from '../../hooks/useWorkspaceMembers';
import { usePermission } from '../../hooks/usePermission';
import { useInfiniteScrollTrigger } from '../../hooks/useInfiniteScrollTrigger';
import SettingsTabs from './SettingsTabs';

const ROLE_OPTIONS = ['owner', 'admin', 'member', 'viewer'];
const ROLE_DROPDOWN_OPTIONS = ROLE_OPTIONS.map((role) => ({ value: role, label: role }));

function SettingsMembersPage() {
  const { role } = usePermission();
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'member' });
  const [actionError, setActionError] = useState('');
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [view, setView] = useState('members');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [limit] = useState(100);
  const listScrollRef = useRef(null);

  const {
    listItems,
    listMeta,
    loadingList,
    loadingMoreList,
    hasMoreList,
    loadMoreList,
    listError,
    canManageMembers,
    inviteMember,
    revokeInvite,
    updateRole,
    removeMember,
    inviteState,
    updateRoleState,
    removeMemberState,
  } = useWorkspaceMembers({
    view,
    limit,
    search,
    role: roleFilter,
  });

  const isInvitesView = view === 'invites';
  const totalItems = listMeta.total || 0;
  const listSentinelRef = useInfiniteScrollTrigger({
    rootRef: listScrollRef,
    onIntersect: () => {
      if (hasMoreList && !loadingMoreList) void loadMoreList();
    },
    disabled: !hasMoreList || loadingMoreList,
  });

  useEffect(() => {
    const timeout = setTimeout(() => setSearch(searchInput.trim()), 250);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    if (!isInviteModalOpen) return undefined;
    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsInviteModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isInviteModalOpen]);

  const handleInvite = async (event) => {
    event.preventDefault();
    setActionError('');
    try {
      await inviteMember({
        email: inviteForm.email.trim(),
        role: inviteForm.role,
      });
      setInviteForm({ email: '', role: 'member' });
      setIsInviteModalOpen(false);
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

  const resetFilters = () => {
    setSearchInput('');
    setSearch('');
    setRoleFilter('all');
    setView('members');
  };

  return (
    <main className="min-h-screen sv-settings-page">
      <div className="sv-settings-shell">
        <SettingsTabs />

        <section className="sv-settings-header sv-settings-members-header">
          <div>
            <h1 className="sv-settings-title">Workspace Members</h1>
            <p className="sv-settings-subtitle">Manage workspace access, roles, and pending invites.</p>
          </div>
          {canManageMembers ? (
            <button
              type="button"
              className="sv-settings-btn sv-settings-btn-primary"
              onClick={() => setIsInviteModalOpen(true)}
            >
              <Icon name="person_add" className="text-[1rem]" />
              Invite Member
            </button>
          ) : (
            <DeniedActionButton role={role} actionLabel="invite members" className="sv-settings-btn sv-settings-btn-primary">
              Invite Member
            </DeniedActionButton>
          )}
        </section>

        {listError || actionError ? (
          <div className="sv-settings-alert">
            {listError || actionError}
          </div>
        ) : null}

        <section className="sv-settings-card sv-settings-members-toolbar-card mb-8">
          <div className="sv-settings-members-toolbar-top">
            <h2 className="sv-settings-card-title">Directory</h2>
            <button
              type="button"
              className={`sv-settings-btn sv-settings-btn-neutral sv-settings-members-filter-btn ${isFilterOpen ? 'is-active' : ''}`}
              onClick={() => setIsFilterOpen((prev) => !prev)}
            >
              <Icon name="filter_alt" className="text-[0.95rem]" />
              Filter
            </button>
          </div>

          <div className={`sv-settings-members-filter-panel ${isFilterOpen ? 'is-open' : 'is-collapsed'}`}>
            <div className="sv-settings-members-filter-grid">
              <label className="sv-settings-field">
                <span className="sv-settings-label">Search</span>
                <input
                  type="text"
                  value={searchInput}
                  onChange={(event) => {
                    setSearchInput(event.target.value);
                    listScrollRef.current?.scrollTo({ top: 0 });
                  }}
                  placeholder={isInvitesView ? 'Search pending invites...' : 'Search workspace members...'}
                  className="sv-settings-input"
                />
              </label>
              <label className="sv-settings-field">
                <span className="sv-settings-label">Role</span>
                <SelectDropdown
                  value={roleFilter}
                  onChange={(nextValue) => {
                    setRoleFilter(nextValue);
                    listScrollRef.current?.scrollTo({ top: 0 });
                  }}
                  options={[{ value: 'all', label: 'All roles' }, ...ROLE_DROPDOWN_OPTIONS]}
                  triggerClassName="sv-settings-input capitalize"
                />
              </label>
            </div>

            <div className="sv-settings-members-filter-bottom">
              <div className="sv-settings-members-view-switch" role="tablist" aria-label="Directory view switch">
                <button
                  type="button"
                  role="tab"
                  className={`sv-settings-tab ${!isInvitesView ? 'is-active' : ''}`}
                  aria-selected={!isInvitesView}
                  onClick={() => {
                    setView('members');
                    listScrollRef.current?.scrollTo({ top: 0 });
                  }}
                >
                  Members
                </button>
                <button
                  type="button"
                  role="tab"
                  className={`sv-settings-tab ${isInvitesView ? 'is-active' : ''}`}
                  aria-selected={isInvitesView}
                  disabled={!canManageMembers}
                  title={!canManageMembers ? `${role} cannot view pending invites` : undefined}
                  onClick={() => {
                    if (!canManageMembers) return;
                    setView('invites');
                    listScrollRef.current?.scrollTo({ top: 0 });
                  }}
                >
                  Pending Invites
                </button>
              </div>
              <button type="button" className="sv-settings-btn sv-settings-btn-neutral" onClick={resetFilters}>
                <Icon name="restart_alt" className="text-[0.95rem]" />
                Reset
              </button>
            </div>
          </div>
        </section>

        <section className="sv-settings-card mb-8">
          <div className="sv-settings-members-list-head">
            <h2 className="sv-settings-card-title mb-0">{isInvitesView ? 'Pending Invites' : 'Members'}</h2>
            <p className="sv-settings-note mb-0">{totalItems} total</p>
          </div>

          {loadingList ? (
            <div className="space-y-3">
              <div className="h-10 animate-pulse rounded-lg bg-surface-container" />
              <div className="h-10 animate-pulse rounded-lg bg-surface-container" />
              <div className="h-10 animate-pulse rounded-lg bg-surface-container" />
            </div>
          ) : listItems.length ? (
            <div className="sv-settings-table-wrap sv-list-scroll" ref={listScrollRef}>
              <table className="sv-settings-table">
                {!isInvitesView ? (
                  <>
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
                      {listItems.map((member) => (
                        <tr key={member.userId}>
                          <td className="text-sm font-medium text-on-surface">{member.name}</td>
                          <td className="text-sm text-on-surface-variant">{member.email}</td>
                          <td>
                            {canManageMembers ? (
                              <SelectDropdown
                                value={member.role}
                                onChange={(nextValue) => handleRoleChange(member.userId, nextValue)}
                                disabled={updateRoleState.isPending}
                                options={ROLE_DROPDOWN_OPTIONS}
                                triggerClassName="sv-settings-table-select capitalize"
                              />
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
                            ) : (
                              <DeniedActionButton role={role} actionLabel="remove members">
                                Remove
                              </DeniedActionButton>
                            )}
                          </td>
                        </tr>
                      ))}
                      <tr>
                        <td colSpan={5} className="sv-list-sentinel-cell">
                          <span ref={listSentinelRef} className="sv-list-sentinel" />
                          {loadingMoreList ? 'Loading more members...' : hasMoreList ? 'Scroll for more' : 'End of list'}
                        </td>
                      </tr>
                    </tbody>
                  </>
                ) : (
                  <>
                    <thead>
                      <tr>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Invited</th>
                        <th>Expires</th>
                        <th className="text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {listItems.map((invite) => (
                        <tr key={invite._id || invite.id}>
                          <td className="text-sm font-medium text-on-surface">{invite.email}</td>
                          <td className="text-sm capitalize text-on-surface-variant">{invite.role}</td>
                          <td className="text-xs text-on-surface-variant">
                            {invite.createdAt ? new Date(invite.createdAt).toLocaleDateString() : '-'}
                          </td>
                          <td className="text-xs text-on-surface-variant">
                            {invite.expiresAt ? new Date(invite.expiresAt).toLocaleString() : 'N/A'}
                          </td>
                          <td className="text-right">
                            {canManageMembers ? (
                              <button
                                type="button"
                                onClick={() => handleRevokeInvite(invite._id || invite.id)}
                                className="sv-settings-btn sv-settings-btn-danger"
                              >
                                <Icon name="mail_off" className="text-[0.95rem]" />
                                Revoke
                              </button>
                            ) : (
                              <DeniedActionButton role={role} actionLabel="revoke invites">
                                Revoke
                              </DeniedActionButton>
                            )}
                          </td>
                        </tr>
                      ))}
                      <tr>
                        <td colSpan={5} className="sv-list-sentinel-cell">
                          <span ref={listSentinelRef} className="sv-list-sentinel" />
                          {loadingMoreList ? 'Loading more invites...' : hasMoreList ? 'Scroll for more' : 'End of list'}
                        </td>
                      </tr>
                    </tbody>
                  </>
                )}
              </table>
            </div>
          ) : (
            <p className="sv-settings-note">
              {isInvitesView ? 'No pending invites found.' : 'No workspace members found.'}
            </p>
          )}

        </section>

        {isInviteModalOpen ? (
          <div
            className="sv-modal-backdrop"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setIsInviteModalOpen(false);
              }
            }}
          >
            <div className="sv-modal-panel sv-settings-members-invite-modal sv-card" role="dialog" aria-modal="true">
              <div className="d-flex align-items-center justify-content-between px-4 py-3 border-bottom border-outline-variant">
                <h3 className="m-0 text-xl font-semibold text-on-surface">Invite Member</h3>
                <button
                  type="button"
                  className="sv-modal-close-btn"
                  onClick={() => setIsInviteModalOpen(false)}
                  aria-label="Close invite member modal"
                >
                  <Icon name="close" />
                </button>
              </div>

              <form onSubmit={handleInvite} className="p-4 sv-settings-members-invite-modal-body">
                {!canManageMembers ? (
                  <p className="sv-settings-note">Only Owner/Admin can invite members.</p>
                ) : (
                  <>
                    <div className="sv-settings-form-grid">
                      <label className="sv-settings-field">
                        <span className="sv-settings-label">Email</span>
                        <input
                          type="email"
                          required
                          value={inviteForm.email}
                          onChange={(event) => setInviteForm((prev) => ({ ...prev, email: event.target.value }))}
                          placeholder="member@company.com"
                          className="sv-settings-input"
                        />
                      </label>
                      <label className="sv-settings-field">
                        <span className="sv-settings-label">Role</span>
                        <SelectDropdown
                          value={inviteForm.role}
                          onChange={(nextValue) => setInviteForm((prev) => ({ ...prev, role: nextValue }))}
                          options={ROLE_DROPDOWN_OPTIONS}
                          triggerClassName="sv-settings-input capitalize"
                        />
                      </label>
                    </div>
                    <div className="sv-settings-form-actions justify-content-end mt-3">
                      <button
                        type="button"
                        className="sv-settings-btn sv-settings-btn-neutral"
                        onClick={() => setIsInviteModalOpen(false)}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={inviteState.isPending}
                        className="sv-settings-btn sv-settings-btn-primary"
                      >
                        <Icon name="person_add" className="text-[1rem]" />
                        {inviteState.isPending ? 'Inviting...' : 'Send Invite'}
                      </button>
                    </div>
                  </>
                )}
              </form>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}

export default SettingsMembersPage;

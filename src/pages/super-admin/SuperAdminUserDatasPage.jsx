import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Icon from '../../components/ui/Icon';
import RowActionMenu from '../../components/ui/RowActionMenu';
import SelectDropdown from '../../components/ui/SelectDropdown';
import { superAdminApi } from '../../api/superAdmin.api';
import { useInfiniteScrollTrigger } from '../../hooks/useInfiniteScrollTrigger';
import { useSocket } from '../../contexts/SocketContext';
import { EVENTS } from '../../socket/events';
import { AdminState, SuperAdminPageHeader } from './SuperAdminShared';
import '../../styles/superadmin.css';

const ROLE_OPTIONS = ['owner', 'admin', 'member', 'viewer'];
const STATUS_OPTIONS = ['active', 'pending', 'inactive'];
const ROLE_DROPDOWN_OPTIONS = ROLE_OPTIONS.map((role) => ({ value: role, label: role }));
const STATUS_DROPDOWN_OPTIONS = STATUS_OPTIONS.map((status) => ({ value: status, label: status }));

function formatDate(value) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString();
}

function formatNumber(value) {
  return new Intl.NumberFormat().format(Number(value || 0));
}

function getRowKey(item) {
  return `${item.workspaceId}:${item.userId}`;
}

function getNextPageParam(lastPage, allPages) {
  const meta = lastPage?.meta || {};
  const page = Number(meta.page) || allPages.length;
  const total = Number(meta.total) || 0;
  const limit = Number(meta.limit) || 100;
  return total > page * limit ? page + 1 : undefined;
}

export default function SuperAdminUserDatasPage() {
  const queryClient = useQueryClient();
  const { socket } = useSocket();
  const [searchParams] = useSearchParams();

  const [search, setSearch] = useState('');
  const [workspaceId, setWorkspaceId] = useState(() => searchParams.get('workspaceId') || '');
  const [role, setRole] = useState('');
  const [status, setStatus] = useState('');
  const [limit] = useState(100);
  const listScrollRef = useRef(null);
  const [toast, setToast] = useState(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedRows, setSelectedRows] = useState(() => new Set());
  const [openActionKey, setOpenActionKey] = useState('');
  const [nextRoleByKey, setNextRoleByKey] = useState({});
  const [pendingRoleKey, setPendingRoleKey] = useState('');
  const [detailItem, setDetailItem] = useState(null);
  const [confirmState, setConfirmState] = useState(null);
  const [bulkRole, setBulkRole] = useState('');

  const workspacesQuery = useQuery({
    queryKey: ['super-admin', 'workspaces', 'filter-options'],
    queryFn: ({ signal }) => superAdminApi.workspaces({ page: 1, limit: 100 }, signal),
    retry: false,
  });

  const usersQuery = useInfiniteQuery({
    queryKey: ['super-admin', 'all-users', limit, search, workspaceId, role, status],
    queryFn: ({ pageParam = 1, signal }) =>
      superAdminApi.allUsers(
        {
          page: pageParam,
          limit,
          search: search || undefined,
          workspaceId: workspaceId || undefined,
          role: role || undefined,
          status: status || undefined,
        },
        signal,
      ),
    getNextPageParam,
    initialPageParam: 1,
    retry: false,
  });

  const refreshAdminData = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'summary'] }),
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'workspaces'] }),
      queryClient.invalidateQueries({ queryKey: ['super-admin', 'all-users'] }),
    ]);
  }, [queryClient]);

  useEffect(() => {
    if (!socket) return undefined;
    const onUsersChanged = () => {
      void refreshAdminData();
    };
    socket.on(EVENTS.SUPERADMIN_USERS_UPDATED, onUsersChanged);
    return () => {
      socket.off(EVENTS.SUPERADMIN_USERS_UPDATED, onUsersChanged);
    };
  }, [socket, refreshAdminData]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const nextWorkspaceId = searchParams.get('workspaceId') || '';
    setWorkspaceId((current) => (current === nextWorkspaceId ? current : nextWorkspaceId));
    if (nextWorkspaceId) {
      setFiltersOpen(true);
      listScrollRef.current?.scrollTo({ top: 0 });
    }
  }, [searchParams]);

  useEffect(() => {
    const onEscape = (event) => {
      if (event.key === 'Escape') {
        setDetailItem(null);
        setConfirmState(null);
        setOpenActionKey('');
      }
    };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, []);

  const roleMutation = useMutation({
    mutationFn: ({ nextWorkspaceId, userId, nextRole }) => superAdminApi.updateRole(nextWorkspaceId, userId, nextRole),
    onMutate: ({ nextWorkspaceId, userId }) => {
      setPendingRoleKey(`${nextWorkspaceId}:${userId}`);
      setToast(null);
    },
    onSuccess: async () => {
      setToast({ type: 'success', message: 'Role updated successfully.' });
      await refreshAdminData();
    },
    onError: (error) => setToast({ type: 'error', message: error.message || 'Failed to update role.' }),
    onSettled: () => setPendingRoleKey(''),
  });

  const removeMutation = useMutation({
    mutationFn: ({ nextWorkspaceId, userId }) => superAdminApi.removeUser(nextWorkspaceId, userId),
    onSuccess: async () => {
      setToast({ type: 'success', message: 'User removed from workspace.' });
      setSelectedRows(new Set());
      setOpenActionKey('');
      setSelectionMode(false);
      setDetailItem(null);
      setConfirmState(null);
      await refreshAdminData();
    },
    onError: (error) => setToast({ type: 'error', message: error.message || 'Failed to remove user from workspace.' }),
  });

  const bulkRemoveMutation = useMutation({
    mutationFn: (items) => superAdminApi.bulkRemoveUsers(items),
    onSuccess: async (response) => {
      const removedCount = response?.data?.removedCount || 0;
      setToast({ type: 'success', message: `${formatNumber(removedCount)} user workspace membership removed.` });
      setSelectedRows(new Set());
      setOpenActionKey('');
      setSelectionMode(false);
      setConfirmState(null);
      await refreshAdminData();
    },
    onError: (error) => setToast({ type: 'error', message: error.message || 'Failed to delete selected users.' }),
  });

  const users = useMemo(() => (usersQuery.data?.pages || []).flatMap((pageItem) => pageItem?.data || []), [usersQuery.data?.pages]);
  const meta = usersQuery.data?.pages?.at(-1)?.meta || {};
  const workspaces = workspacesQuery.data?.data || [];
  const loadMoreRef = useInfiniteScrollTrigger({
    rootRef: listScrollRef,
    onIntersect: () => {
      if (usersQuery.hasNextPage && !usersQuery.isFetchingNextPage) void usersQuery.fetchNextPage();
    },
    disabled: !usersQuery.hasNextPage || usersQuery.isFetchingNextPage,
  });
  const visibleKeys = useMemo(() => users.map(getRowKey), [users]);
  const selectedItems = useMemo(() => users.filter((item) => selectedRows.has(getRowKey(item))), [selectedRows, users]);
  const allVisibleSelected = Boolean(visibleKeys.length) && visibleKeys.every((key) => selectedRows.has(key));
  const hasActiveFilters = Boolean(workspaceId || role || status);
  const isDeleting = removeMutation.isPending || bulkRemoveMutation.isPending;

  useEffect(() => {
    setSelectedRows(new Set());
    setOpenActionKey('');
    setSelectionMode(false);
    setDetailItem(null);
  }, [limit, search, workspaceId, role, status]);

  useEffect(() => {
    setSelectedRows((current) => {
      const allowed = new Set(visibleKeys);
      const next = new Set([...current].filter((key) => allowed.has(key)));
      return next.size === current.size ? current : next;
    });
  }, [visibleKeys]);

  useEffect(() => {
    if (selectionMode && selectedRows.size === 0) {
      setSelectionMode(false);
      setBulkRole('');
    }
  }, [selectionMode, selectedRows.size]);

  useEffect(() => {
    if (!detailItem) return;
    const exists = users.some((item) => getRowKey(item) === getRowKey(detailItem));
    if (!exists) setDetailItem(null);
  }, [users, detailItem]);

  function resetList(setter) {
    return (event) => {
      setter(event.target.value);
      listScrollRef.current?.scrollTo({ top: 0 });
    };
  }

  function clearFilters() {
    setWorkspaceId('');
    setRole('');
    setStatus('');
    listScrollRef.current?.scrollTo({ top: 0 });
  }

  function clearFilterChip(key) {
    if (key === 'workspace') setWorkspaceId('');
    if (key === 'role') setRole('');
    if (key === 'status') setStatus('');
    listScrollRef.current?.scrollTo({ top: 0 });
  }

  function clearSelection() {
    setSelectedRows(new Set());
    setSelectionMode(false);
    setBulkRole('');
  }

  function toggleRow(item) {
    const key = getRowKey(item);
    setSelectedRows((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  function selectVisibleRows() {
    if (!visibleKeys.length) return;
    setSelectionMode(true);
    setSelectedRows(new Set(visibleKeys));
  }

  function toggleSelectAllOrClearAll() {
    if (selectedRows.size === 0) {
      selectVisibleRows();
      return;
    }
    clearSelection();
  }

  function selectSingleRow(item) {
    setSelectionMode(true);
    setSelectedRows(new Set([getRowKey(item)]));
    setOpenActionKey('');
  }

  function toggleVisibleRows() {
    if (allVisibleSelected) {
      setSelectedRows(new Set());
      return;
    }
    setSelectionMode(true);
    setSelectedRows(new Set(visibleKeys));
  }

  async function copyEmail(email) {
    try {
      await navigator.clipboard.writeText(email);
      setToast({ type: 'success', message: 'Email copied.' });
    } catch {
      setToast({ type: 'info', message: email });
    }
    setOpenActionKey('');
  }

  function removeUser(item) {
    setConfirmState({
      mode: 'single',
      title: 'Remove user from workspace',
      message: `Remove ${item.name || item.email} from ${item.workspace?.name || 'this workspace'}?`,
      item,
    });
  }

  function askBulkDelete() {
    if (!selectedItems.length) return;
    setConfirmState({
      mode: 'bulk',
      title: 'Delete selected memberships',
      message: `Remove ${selectedItems.length} selected workspace memberships?`,
    });
  }

  function applyRoleChange(item) {
    const key = getRowKey(item);
    const nextRole = nextRoleByKey[key] || item.role;
    if (nextRole === item.role) {
      return;
    }
    roleMutation.mutate({
      nextWorkspaceId: item.workspaceId,
      userId: item.userId,
      nextRole,
    });
  }

  function applyBulkRole() {
    if (!bulkRole || !selectedItems.length) return;
    selectedItems.forEach((item) => {
      roleMutation.mutate({
        nextWorkspaceId: item.workspaceId,
        userId: item.userId,
        nextRole: bulkRole,
      });
    });
    setBulkRole('');
  }

  function confirmDelete() {
    if (!confirmState) return;
    if (confirmState.mode === 'single') {
      const item = confirmState.item;
      removeMutation.mutate({ nextWorkspaceId: item.workspaceId, userId: item.userId });
      return;
    }
    bulkRemoveMutation.mutate(selectedItems.map((item) => ({ workspaceId: item.workspaceId, userId: item.userId })));
  }

  const activeFilterChips = [
    workspaceId ? { key: 'workspace', label: `Workspace: ${workspaces.find((w) => w.id === workspaceId)?.name || workspaceId}` } : null,
    role ? { key: 'role', label: `Role: ${role}` } : null,
    status ? { key: 'status', label: `Status: ${status}` } : null,
  ].filter(Boolean);

  return (
    <main className="sv-userdatas-page container-fluid px-3 px-md-4 px-xl-5 pb-5 pb-lg-6">
      <SuperAdminPageHeader
        eyebrow="User Management"
        title="User Datas"
        badge={`${formatNumber(meta.total || 0)} users`}
        badgeIcon="group"
      />

      <section className="sv-userdatas-topbar" aria-label="Search and filters">
        <label className="sv-userdatas-search">
          <Icon name="search" />
          <input
            className="form-control"
            value={search}
            onChange={resetList(setSearch)}
            placeholder="Search name, email, workspace..."
          />
        </label>
        <button
          type="button"
          className={`btn ${filtersOpen ? 'btn-primary' : 'btn-outline-primary'} sv-userdatas-filter-trigger`}
          onClick={() => setFiltersOpen((value) => !value)}
          aria-label="Toggle filters"
        >
          <Icon name="tune" />
          {hasActiveFilters ? <span className="sv-userdatas-filter-dot" aria-label="Filters active" /> : null}
        </button>
      </section>

      {activeFilterChips.length ? (
        <section className="sv-userdatas-chip-row" aria-label="Active filters">
          {activeFilterChips.map((chip) => (
            <button key={chip.key} type="button" className="sv-userdatas-chip" onClick={() => clearFilterChip(chip.key)}>
              <span>{chip.label}</span>
              <Icon name="close" />
            </button>
          ))}
          <button type="button" className="sv-userdatas-chip sv-userdatas-chip-clear" onClick={clearFilters}>
            <Icon name="filter_alt_off" />
            Clear all filters
          </button>
        </section>
      ) : null}

      {filtersOpen ? (
        <section className="sv-userdatas-filters" aria-label="User filters and bulk actions">
          <label>
            <span className="sv-userdatas-field-label"><Icon name="apartment" />Workspace</span>
            <SelectDropdown
              value={workspaceId}
              onChange={(nextValue) => {
                setWorkspaceId(nextValue);
                listScrollRef.current?.scrollTo({ top: 0 });
              }}
              options={[
                { value: '', label: 'All workspaces' },
                ...workspaces.map((workspace) => ({ value: workspace.id, label: workspace.name })),
              ]}
              triggerClassName="form-select"
            />
          </label>
          <label>
            <span className="sv-userdatas-field-label"><Icon name="manage_accounts" />Role</span>
            <SelectDropdown value={role} onChange={(nextValue) => { setRole(nextValue); listScrollRef.current?.scrollTo({ top: 0 }); }} options={[{ value: '', label: 'All roles' }, ...ROLE_DROPDOWN_OPTIONS]} triggerClassName="form-select" />
          </label>
          <label>
            <span className="sv-userdatas-field-label"><Icon name="verified_user" />Status</span>
            <SelectDropdown value={status} onChange={(nextValue) => { setStatus(nextValue); listScrollRef.current?.scrollTo({ top: 0 }); }} options={[{ value: '', label: 'All statuses' }, ...STATUS_DROPDOWN_OPTIONS]} triggerClassName="form-select" />
          </label>
          <div className="sv-userdatas-filter-actions">
            <span className="sv-userdatas-selected-count"><Icon name="checklist" />{selectedRows.size} selected</span>
            <button
              type="button"
              className="btn btn-outline-secondary"
              disabled={!users.length}
              onClick={toggleSelectAllOrClearAll}
            >
              <Icon name={selectedRows.size > 0 ? 'deselect' : 'select_all'} />
              {selectedRows.size > 0 ? 'Clear all' : 'Select all'}
            </button>
            <button type="button" className="btn btn-danger sv-userdatas-delete-btn" disabled={!selectedRows.size || isDeleting} onClick={askBulkDelete}>
              <Icon name="delete" />
              Delete
            </button>
            <div className="sv-userdatas-bulk-role">
              <SelectDropdown value={bulkRole} onChange={setBulkRole} options={[{ value: '', label: 'Change role' }, ...ROLE_DROPDOWN_OPTIONS]} triggerClassName="form-select form-select-sm" />
              <button type="button" className="btn btn-sm btn-outline-primary" disabled={!bulkRole || !selectedRows.size || Boolean(pendingRoleKey)} onClick={applyBulkRole}>
                <Icon name="check" />
                Apply
              </button>
            </div>
            <button type="button" className="btn btn-outline-secondary" onClick={clearFilters}>
              <Icon name="filter_alt_off" />
              Clear filters
            </button>
          </div>
        </section>
      ) : null}

      {usersQuery.isError && !users.length ? <div className="sv-userdatas-error sv-admin-inline-alert"><Icon name="error" />Unable to load users. Refresh and try again.</div> : null}

      <section className="sv-userdatas-table-card" aria-label="Users">
        <div className="sv-userdatas-table-head">
          <div>
            <h2>Users</h2>
            <p>Manage workspace roles across all accounts.</p>
          </div>
          <span>{formatNumber(meta.total || 0)} records</span>
        </div>
        <div className="sv-userdatas-table-wrap sv-list-scroll" ref={listScrollRef}>
          <table className="sv-userdatas-table">
            <thead>
              <tr>
                {selectionMode ? (
                  <th className="sv-userdatas-check-cell">
                    <input
                      type="checkbox"
                      className="form-check-input"
                      aria-label="Select visible users"
                      checked={allVisibleSelected}
                      disabled={!users.length}
                      onChange={toggleVisibleRows}
                    />
                  </th>
                ) : null}
                <th>User</th>
                <th>Workspace</th>
                <th>Status</th>
                <th>Role</th>
                <th>Joined</th>
                <th>Last login</th>
                <th className="sv-userdatas-action-heading">Action</th>
              </tr>
            </thead>
            <tbody>
              {usersQuery.isLoading ? (
                <tr>
                  <td colSpan={selectionMode ? 8 : 7} className="sv-userdatas-state"><AdminState icon="progress_activity" title="Loading users" text="Reading workspace membership data." /></td>
                </tr>
              ) : null}
              {!usersQuery.isLoading && !users.length ? (
                <tr>
                  <td colSpan={selectionMode ? 8 : 7} className="sv-userdatas-state"><AdminState icon="group" title="No users found" text="Try changing search or filter values." /></td>
                </tr>
              ) : null}
              {users.map((item) => {
                const key = getRowKey(item);
                const isSelected = selectedRows.has(key);
                return (
                  <tr key={key} className={isSelected ? 'is-selected' : ''}>
                    {selectionMode ? (
                      <td className="sv-userdatas-check-cell">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          aria-label={`Select ${item.name || item.email}`}
                          checked={isSelected}
                          onChange={() => toggleRow(item)}
                        />
                      </td>
                    ) : null}
                    <td>
                      <div className="sv-userdatas-user-cell">
                        <span className="sv-userdatas-avatar">{(item.name || item.email || '?').slice(0, 1).toUpperCase()}</span>
                        <span>
                          <strong>{item.name}</strong>
                          <small>{item.email}</small>
                        </span>
                      </div>
                    </td>
                    <td>
                      <div className="sv-userdatas-two-line">
                        <strong>{item.workspace?.name || '-'}</strong>
                        <small>{item.workspace?.slug || ''}</small>
                      </div>
                    </td>
                    <td>
                      <span className={`sv-userdatas-status-badge ${item.isActive ? 'is-active' : 'is-inactive'}`}>
                        {item.status}{item.isActive ? '' : ' / inactive'}
                      </span>
                    </td>
                    <td>
                      <span className={`sv-userdatas-role-badge is-${item.role}`}>{item.role}</span>
                    </td>
                    <td>{formatDate(item.joinedAt)}</td>
                    <td>{formatDate(item.lastLoginAt)}</td>
                    <td className="sv-userdatas-action-cell">
                      <RowActionMenu
                        open={openActionKey === key}
                        onTrigger={() => setOpenActionKey((current) => (current === key ? '' : key))}
                        onClose={() => setOpenActionKey('')}
                        ariaLabel={`Actions for ${item.name || item.email}`}
                        items={[
                          {
                            key: 'details',
                            label: 'View details',
                            icon: 'visibility',
                            onClick: () => setDetailItem(item),
                          },
                          {
                            key: 'select',
                            label: 'Select row',
                            icon: 'check_box',
                            onClick: () => selectSingleRow(item),
                          },
                          {
                            key: 'remove',
                            label: 'Remove',
                            icon: 'person_remove',
                            danger: true,
                            disabled: isDeleting,
                            onClick: () => removeUser(item),
                          },
                        ]}
                      />
                    </td>
                  </tr>
                );
              })}
              {!usersQuery.isLoading && users.length ? (
                <tr>
                  <td colSpan={selectionMode ? 8 : 7} className="sv-list-sentinel-cell">
                    <span ref={loadMoreRef} className="sv-list-sentinel" />
                    {usersQuery.isFetchingNextPage ? 'Loading more users...' : usersQuery.hasNextPage ? 'Scroll for more' : 'End of list'}
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {detailItem ? (
        <div className="sv-userdatas-drawer-layer" role="presentation">
          <button type="button" className="sv-userdatas-drawer-backdrop" aria-label="Close details" onClick={() => setDetailItem(null)} />
          <aside className="sv-userdatas-drawer" role="dialog" aria-modal="true" aria-label="User details">
            <header>
              <div className="sv-userdatas-drawer-identity">
                <span className="sv-userdatas-avatar">{(detailItem.name || detailItem.email || '?').slice(0, 1).toUpperCase()}</span>
                <div>
                  <h3>{detailItem.name}</h3>
                  <p>{detailItem.email}</p>
                </div>
              </div>
              <button type="button" className="sv-userdatas-drawer-close" onClick={() => setDetailItem(null)} aria-label="Close">
                <Icon name="close" />
              </button>
            </header>
            <section className="sv-userdatas-drawer-body">
              <div className="sv-userdatas-drawer-meta">
                <div className="sv-userdatas-drawer-meta-item">
                  <Icon name="apartment" />
                  <span>Workspace</span>
                  <strong>{detailItem.workspace?.name || '-'}</strong>
                </div>
                <div className="sv-userdatas-drawer-meta-item">
                  <Icon name="fingerprint" />
                  <span>Slug</span>
                  <strong>{detailItem.workspace?.slug || '-'}</strong>
                </div>
                <div className="sv-userdatas-drawer-meta-item">
                  <Icon name="calendar_today" />
                  <span>Joined</span>
                  <strong>{formatDate(detailItem.joinedAt)}</strong>
                </div>
                <div className="sv-userdatas-drawer-meta-item">
                  <Icon name="schedule" />
                  <span>Last login</span>
                  <strong>{formatDate(detailItem.lastLoginAt)}</strong>
                </div>
              </div>
              <div className="sv-userdatas-drawer-row">
                <label><Icon name="manage_accounts" />Role</label>
                <SelectDropdown
                  value={nextRoleByKey[getRowKey(detailItem)] || detailItem.role}
                  onChange={(nextValue) =>
                    setNextRoleByKey((current) => ({ ...current, [getRowKey(detailItem)]: nextValue }))
                  }
                  options={ROLE_DROPDOWN_OPTIONS}
                  triggerClassName="form-select"
                />
                <button type="button" className="btn btn-primary" disabled={pendingRoleKey === getRowKey(detailItem)} onClick={() => applyRoleChange(detailItem)}>
                  Update role
                </button>
              </div>
              <div className="sv-userdatas-drawer-row">
                <label><Icon name="verified_user" />Status</label>
                <div className="sv-userdatas-drawer-status">
                  <span className={`sv-userdatas-status-badge ${detailItem.isActive ? 'is-active' : 'is-inactive'}`}>
                    {detailItem.status}{detailItem.isActive ? '' : ' / inactive'}
                  </span>
                </div>
              </div>
            </section>
            <footer>
              <button type="button" className="btn btn-outline-secondary" onClick={() => copyEmail(detailItem.email)}>
                <Icon name="content_copy" />Copy email
              </button>
              <button type="button" className="btn btn-danger" disabled={isDeleting} onClick={() => removeUser(detailItem)}>
                <Icon name="person_remove" />Remove from workspace
              </button>
            </footer>
          </aside>
        </div>
      ) : null}

      {confirmState ? (
        <div className="sv-userdatas-confirm-layer" role="presentation">
          <button type="button" className="sv-userdatas-confirm-backdrop" aria-label="Close confirm" onClick={() => setConfirmState(null)} />
          <div className="sv-userdatas-confirm-modal" role="dialog" aria-modal="true" aria-label={confirmState.title}>
            <h4>{confirmState.title}</h4>
            <p>{confirmState.message}</p>
            <div className="sv-userdatas-confirm-actions">
              <button type="button" className="btn btn-outline-secondary" onClick={() => setConfirmState(null)}>Cancel</button>
              <button type="button" className="btn btn-danger" disabled={isDeleting} onClick={confirmDelete}>
                {isDeleting ? 'Removing...' : 'Confirm remove'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className={`sv-userdatas-toast is-${toast.type}`} role="status" aria-live="polite">
          <Icon name={toast.type === 'error' ? 'error' : 'check_circle'} />
          <span>{toast.message}</span>
        </div>
      ) : null}
    </main>
  );
}

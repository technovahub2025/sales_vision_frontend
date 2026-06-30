import { useEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { workspacesApi } from '../../api';
import SelectDropdown from '../../components/ui/SelectDropdown';
import Icon from '../../components/ui/Icon';
import DeniedActionButton from '../../components/ui/DeniedActionButton';
import { useSettings } from '../../hooks/useSettings';
import { usePermission } from '../../hooks/usePermission';
import { useInfiniteScrollTrigger } from '../../hooks/useInfiniteScrollTrigger';
import SettingsTabs from './SettingsTabs';

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'name_asc', label: 'Name (A-Z)' },
  { value: 'name_desc', label: 'Name (Z-A)' },
];
const STATUS_OPTIONS = [
  { value: 'all', label: 'All status' },
  { value: 'active', label: 'Active only' },
  { value: 'inactive', label: 'Inactive only' },
];

const DEFAULT_META = { page: 1, limit: 8, total: 0, pages: 1 };

function normalizeWorkspaceListPayload(payload) {
  const items = Array.isArray(payload?.data) ? payload.data : [];
  const metaRaw = payload?.meta || {};
  const page = Number(metaRaw.page) || 1;
  const limit = Number(metaRaw.limit) || 8;
  const total = Number(metaRaw.total) || 0;
  const pages = Number(metaRaw.pages) || Math.max(1, Math.ceil(total / limit));
  return { items, meta: { page, limit, total, pages } };
}

function getNextPageParam(lastPage, allPages) {
  const meta = lastPage?.meta || {};
  const page = Number(meta.page) || allPages.length;
  const pages = Number(meta.pages) || 0;
  if (pages > 0) return page < pages ? page + 1 : undefined;
  const total = Number(meta.total) || 0;
  const limit = Number(meta.limit) || 100;
  return total > page * limit ? page + 1 : undefined;
}

function SettingsWorkspacePage() {
  const queryClient = useQueryClient();
  const { can, role } = usePermission();
  const canUpdateWorkspace = can('workspace', 'update');
  const canDeleteWorkspace = can('workspace', 'delete');
  const {
    activeWorkspaceId,
    switchWorkspace,
    createWorkspace,
    updateWorkspace,
    deleteWorkspace,
    workspaceBusy,
  } = useSettings();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [renameDrafts, setRenameDrafts] = useState({});
  const [actionError, setActionError] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [sort, setSort] = useState('newest');
  const [limit] = useState(100);
  const listScrollRef = useRef(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearch(searchInput.trim());
    }, 250);
    return () => clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    if (!isCreateModalOpen) return undefined;
    const onEsc = (event) => {
      if (event.key === 'Escape') {
        setIsCreateModalOpen(false);
      }
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [isCreateModalOpen]);

  const queryParams = useMemo(() => {
    const params = { limit, sort };
    if (search) params.search = search;
    if (status !== 'all') params.status = status;
    return params;
  }, [limit, search, sort, status]);

  const workspaceQuery = useInfiniteQuery({
    queryKey: ['settings-workspaces', queryParams],
    queryFn: ({ pageParam = 1, signal: abortSignal }) =>
      workspacesApi.list({ ...queryParams, page: pageParam }, abortSignal).then((response) => normalizeWorkspaceListPayload(response || {})),
    getNextPageParam,
    initialPageParam: 1,
    staleTime: 20_000,
    gcTime: 5 * 60_000,
  });

  const items = useMemo(() => (workspaceQuery.data?.pages || []).flatMap((pageItem) => pageItem?.items || []), [workspaceQuery.data?.pages]);
  const meta = workspaceQuery.data?.pages?.at(-1)?.meta || DEFAULT_META;
  const totalItems = meta.total || 0;
  const loadMoreRef = useInfiniteScrollTrigger({
    rootRef: listScrollRef,
    onIntersect: () => {
      if (workspaceQuery.hasNextPage && !workspaceQuery.isFetchingNextPage) void workspaceQuery.fetchNextPage();
    },
    disabled: !workspaceQuery.hasNextPage || workspaceQuery.isFetchingNextPage,
  });

  const rows = useMemo(
    () =>
      items.map((item) => ({
        id: String(item._id || item.id || ''),
        name: item.name || 'Workspace',
        slug: item.slug || '',
        active: Boolean(item.active),
      })),
    [items],
  );

  const refetchList = async () => {
    await queryClient.invalidateQueries({ queryKey: ['settings-workspaces'] });
  };

  const onCreate = async (event) => {
    event.preventDefault();
    if (!canUpdateWorkspace || !newWorkspaceName.trim()) return;
    setActionError('');
    try {
      await createWorkspace({ name: newWorkspaceName.trim() });
      setNewWorkspaceName('');
      setIsCreateModalOpen(false);
      listScrollRef.current?.scrollTo({ top: 0 });
      await refetchList();
    } catch (nextError) {
      setActionError(nextError.message || 'Failed to create workspace');
    }
  };

  const onRename = async (workspaceId) => {
    if (!canUpdateWorkspace) return;
    const nextName = String(renameDrafts[workspaceId] || '').trim();
    if (!nextName) return;
    setActionError('');
    try {
      await updateWorkspace(workspaceId, { name: nextName });
      setRenameDrafts((current) => ({ ...current, [workspaceId]: '' }));
      await refetchList();
    } catch (nextError) {
      setActionError(nextError.message || 'Failed to rename workspace');
    }
  };

  const onDelete = async (workspaceId, workspaceName) => {
    if (!canDeleteWorkspace) return;
    if (!window.confirm(`Delete workspace "${workspaceName}"? This action cannot be undone.`)) return;
    setActionError('');
    try {
      await deleteWorkspace(workspaceId);
      await refetchList();
    } catch (nextError) {
      setActionError(nextError.message || 'Failed to delete workspace');
    }
  };

  const onSwitchWorkspace = async (workspaceId) => {
    setActionError('');
    try {
      switchWorkspace(workspaceId);
      await refetchList();
    } catch (nextError) {
      setActionError(nextError.message || 'Failed to switch workspace');
    }
  };

  const onResetFilters = () => {
    setSearchInput('');
    setSearch('');
    setStatus('all');
    setSort('newest');
    listScrollRef.current?.scrollTo({ top: 0 });
  };

  return (
    <main className="min-h-screen sv-settings-page">
      <div className="sv-settings-shell">
        <SettingsTabs />

        <section className="sv-settings-header sv-settings-members-header">
          <div>
            <h1 className="sv-settings-title">Workspace Settings</h1>
            <p className="sv-settings-subtitle">Create, switch, rename, and delete workspaces.</p>
          </div>
          {canUpdateWorkspace ? (
            <button
              type="button"
              className="sv-settings-btn sv-settings-btn-primary"
              onClick={() => setIsCreateModalOpen(true)}
            >
              <Icon name="add_business" className="text-[1rem]" />
              Create Workspace
            </button>
          ) : (
            <DeniedActionButton role={role} actionLabel="create workspace" className="sv-settings-btn sv-settings-btn-primary">
              Create Workspace
            </DeniedActionButton>
          )}
        </section>

        {workspaceQuery.error?.message || actionError ? (
          <section className="sv-settings-alert">{workspaceQuery.error?.message || actionError}</section>
        ) : null}

        <section className="sv-settings-card sv-settings-members-toolbar-card mb-8">
          <div className="sv-settings-members-toolbar-top">
            <h2 className="sv-settings-card-title">Workspace Directory</h2>
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
                  placeholder="Search workspace name..."
                  className="sv-settings-input"
                />
              </label>
              <label className="sv-settings-field">
                <span className="sv-settings-label">Status</span>
                <SelectDropdown
                  value={status}
                  onChange={(event) => {
                    setStatus(event);
                    listScrollRef.current?.scrollTo({ top: 0 });
                  }}
                  className="sv-settings-input"
                  options={STATUS_OPTIONS}
                />
              </label>
              <label className="sv-settings-field">
                <span className="sv-settings-label">Sort</span>
                <SelectDropdown
                  value={sort}
                  onChange={(event) => {
                    setSort(event);
                    listScrollRef.current?.scrollTo({ top: 0 });
                  }}
                  className="sv-settings-input"
                  options={SORT_OPTIONS}
                />
              </label>
            </div>
            <div className="sv-settings-members-filter-bottom">
              <p className="sv-settings-note mb-0">{totalItems} total workspaces</p>
              <button type="button" className="sv-settings-btn sv-settings-btn-neutral" onClick={onResetFilters}>
                <Icon name="restart_alt" className="text-[0.95rem]" />
                Reset
              </button>
            </div>
          </div>
        </section>

        <section className="sv-settings-card">
          <div className="space-y-3 sv-list-scroll" ref={listScrollRef}>
            {workspaceQuery.isLoading || workspaceQuery.isFetching ? (
              <>
                <div className="h-14 animate-pulse rounded-lg bg-surface-container" />
                <div className="h-14 animate-pulse rounded-lg bg-surface-container" />
                <div className="h-14 animate-pulse rounded-lg bg-surface-container" />
              </>
            ) : rows.length ? (
              rows.map((workspace) => {
                const isActive = String(workspace.id) === String(activeWorkspaceId);
                return (
                  <div key={workspace.id} className="sv-settings-list-item sv-settings-workspace-item">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-on-surface">
                          {workspace.name}
                          <span className={`ml-2 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${workspace.active ? 'bg-primary/10 text-primary' : 'bg-surface-container text-on-surface-variant'}`}>
                            {workspace.active ? 'active' : 'inactive'}
                          </span>
                        </p>
                        <p className="text-xs text-on-surface-variant">{workspace.slug || '-'}</p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        {!isActive ? (
                          <button
                            type="button"
                            onClick={() => onSwitchWorkspace(workspace.id)}
                            className="sv-settings-btn sv-settings-btn-neutral"
                          >
                            <Icon name="sync_alt" className="text-[0.95rem]" />
                            Switch
                          </button>
                        ) : null}
                        {canDeleteWorkspace ? (
                          <button
                            type="button"
                            onClick={() => onDelete(workspace.id, workspace.name)}
                            className="sv-settings-btn sv-settings-btn-danger"
                          >
                            <Icon name="delete" className="text-[0.95rem]" />
                            Delete
                          </button>
                        ) : (
                          <DeniedActionButton role={role} actionLabel="delete workspace">
                            Delete
                          </DeniedActionButton>
                        )}
                      </div>
                    </div>

                    <div className="sv-settings-inline-form mt-3">
                      <input
                        type="text"
                        value={renameDrafts[workspace.id] || ''}
                        onChange={(event) =>
                          setRenameDrafts((current) => ({ ...current, [workspace.id]: event.target.value }))
                        }
                        placeholder="Rename workspace"
                        className="sv-settings-input"
                        disabled={!canUpdateWorkspace}
                      />
                      {canUpdateWorkspace ? (
                        <button
                          type="button"
                          onClick={() => onRename(workspace.id)}
                          disabled={workspaceBusy}
                          className="sv-settings-btn sv-settings-btn-neutral"
                        >
                          <Icon name="drive_file_rename_outline" className="text-[0.95rem]" />
                          Rename
                        </button>
                      ) : (
                        <DeniedActionButton role={role} actionLabel="rename workspace" className="sv-settings-btn sv-settings-btn-neutral">
                          Rename
                        </DeniedActionButton>
                      )}
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="sv-settings-note">No workspaces found for the current filters.</p>
            )}
            {!workspaceQuery.isLoading && rows.length ? (
              <div className="sv-list-sentinel-cell">
                <span ref={loadMoreRef} className="sv-list-sentinel" />
                {workspaceQuery.isFetchingNextPage ? 'Loading more workspaces...' : workspaceQuery.hasNextPage ? 'Scroll for more' : 'End of list'}
              </div>
            ) : null}
          </div>

        </section>

        {isCreateModalOpen ? (
          <div
            className="sv-modal-backdrop"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                setIsCreateModalOpen(false);
              }
            }}
          >
            <div className="sv-modal-panel sv-settings-members-invite-modal sv-settings-workspace-modal sv-card" role="dialog" aria-modal="true">
              <div className="d-flex align-items-center justify-content-between px-4 py-3 border-bottom border-outline-variant">
                <h3 className="m-0 text-xl font-semibold text-on-surface">Create Workspace</h3>
                <button
                  type="button"
                  className="sv-modal-close-btn"
                  onClick={() => setIsCreateModalOpen(false)}
                  aria-label="Close create workspace modal"
                >
                  <Icon name="close" />
                </button>
              </div>
              <form onSubmit={onCreate} className="p-4 sv-settings-members-invite-modal-body">
                <label className="sv-settings-field">
                  <span className="sv-settings-label">Workspace Name</span>
                  <input
                    type="text"
                    required
                    value={newWorkspaceName}
                    onChange={(event) => setNewWorkspaceName(event.target.value)}
                    placeholder="Workspace name"
                    className="sv-settings-input"
                  />
                </label>
                <div className="sv-settings-form-actions justify-content-end mt-3">
                  <button
                    type="button"
                    className="sv-settings-btn sv-settings-btn-neutral"
                    onClick={() => setIsCreateModalOpen(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" disabled={workspaceBusy} className="sv-settings-btn sv-settings-btn-primary">
                    <Icon name="add_business" className="text-[1rem]" />
                    {workspaceBusy ? 'Creating...' : 'Create'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        ) : null}
      </div>
    </main>
  );
}

export default SettingsWorkspacePage;

import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { workspacesApi } from '../../api';
import Icon from '../../components/ui/Icon';
import DeniedActionButton from '../../components/ui/DeniedActionButton';
import { useSettings } from '../../hooks/useSettings';
import { usePermission } from '../../hooks/usePermission';
import SettingsTabs from './SettingsTabs';

const PAGE_SIZE_OPTIONS = [8, 15, 25];
const SORT_OPTIONS = [
  { value: 'recent', label: 'Recently updated' },
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
  const [sort, setSort] = useState('recent');
  const [limit, setLimit] = useState(8);
  const [page, setPage] = useState(1);

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
    const params = { page, limit, sort };
    if (search) params.search = search;
    if (status !== 'all') params.status = status;
    return params;
  }, [limit, page, search, sort, status]);

  const workspaceQuery = useQuery({
    queryKey: ['settings-workspaces', queryParams],
    queryFn: ({ signal: abortSignal }) =>
      workspacesApi.list(queryParams, abortSignal).then((response) => normalizeWorkspaceListPayload(response || {})),
    staleTime: 20_000,
    gcTime: 5 * 60_000,
    initialData: { items: [], meta: { ...DEFAULT_META } },
  });

  const items = useMemo(() => workspaceQuery.data?.items || [], [workspaceQuery.data?.items]);
  const meta = workspaceQuery.data?.meta || DEFAULT_META;
  const totalPages = Math.max(meta.pages || 1, 1);
  const currentPage = Math.min(Math.max(page, 1), totalPages);
  const totalItems = meta.total || 0;
  const startIndex = totalItems > 0 ? (currentPage - 1) * limit + 1 : 0;
  const endIndex = totalItems > 0 ? Math.min((currentPage - 1) * limit + items.length, totalItems) : 0;

  const paginationNumbers = useMemo(() => {
    if (totalPages <= 1) return [1];
    const pages = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
    return [...pages].filter((num) => num >= 1 && num <= totalPages).sort((a, b) => a - b);
  }, [currentPage, totalPages]);

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
      setPage(1);
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
    setSort('recent');
    setLimit(8);
    setPage(1);
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
                    setPage(1);
                  }}
                  placeholder="Search workspace name..."
                  className="sv-settings-input"
                />
              </label>
              <label className="sv-settings-field">
                <span className="sv-settings-label">Status</span>
                <select
                  value={status}
                  onChange={(event) => {
                    setStatus(event.target.value);
                    setPage(1);
                  }}
                  className="sv-settings-input"
                >
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="sv-settings-field">
                <span className="sv-settings-label">Sort</span>
                <select
                  value={sort}
                  onChange={(event) => {
                    setSort(event.target.value);
                    setPage(1);
                  }}
                  className="sv-settings-input"
                >
                  {SORT_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="sv-settings-field">
                <span className="sv-settings-label">Rows per page</span>
                <select
                  value={limit}
                  onChange={(event) => {
                    setLimit(Number(event.target.value) || 8);
                    setPage(1);
                  }}
                  className="sv-settings-input"
                >
                  {PAGE_SIZE_OPTIONS.map((size) => (
                    <option key={size} value={size}>
                      {size}
                    </option>
                  ))}
                </select>
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
          <div className="space-y-3">
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
          </div>

          <div className="sv-settings-members-pagination">
            <div className="sv-settings-members-pagination-meta">
              Showing {startIndex}-{endIndex} of {totalItems}
            </div>
            <div className="sv-settings-members-pagination-controls">
              <button
                type="button"
                className="sv-settings-btn sv-settings-btn-neutral"
                disabled={currentPage <= 1}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
              >
                Prev
              </button>
              {paginationNumbers.map((num) => (
                <button
                  key={num}
                  type="button"
                  className={`sv-settings-btn sv-settings-btn-neutral ${num === currentPage ? 'is-active' : ''}`}
                  onClick={() => setPage(num)}
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                className="sv-settings-btn sv-settings-btn-neutral"
                disabled={currentPage >= totalPages}
                onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
              >
                Next
              </button>
            </div>
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

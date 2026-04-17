import { useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useSettings } from '../../hooks/useSettings';
import { usePermission } from '../../hooks/usePermission';
import { ROUTES } from '../../routes/routePaths';

function tabClassName({ isActive }) {
  return `rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
    isActive ? 'bg-primary text-white' : 'bg-surface-container-low text-on-surface-variant hover:bg-surface-container-high'
  }`;
}

function SettingsWorkspacePage() {
  const { hasAnyRole } = usePermission();
  const canManage = hasAnyRole(['owner', 'admin']);
  const {
    workspaces,
    activeWorkspaceId,
    switchWorkspace,
    createWorkspace,
    updateWorkspace,
    deleteWorkspace,
    workspaceBusy,
    error,
  } = useSettings();

  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [renameDrafts, setRenameDrafts] = useState({});
  const [actionError, setActionError] = useState('');

  const rows = useMemo(
    () =>
      (workspaces || []).map((item) => ({
        id: String(item._id || item.id || ''),
        name: item.name || 'Workspace',
        slug: item.slug || '',
      })),
    [workspaces],
  );

  const onCreate = async (event) => {
    event.preventDefault();
    if (!newWorkspaceName.trim() || !canManage) return;
    setActionError('');
    try {
      await createWorkspace({ name: newWorkspaceName.trim() });
      setNewWorkspaceName('');
    } catch (nextError) {
      setActionError(nextError.message || 'Failed to create workspace');
    }
  };

  const onRename = async (workspaceId) => {
    if (!canManage) return;
    const nextName = String(renameDrafts[workspaceId] || '').trim();
    if (!nextName) return;
    setActionError('');
    try {
      await updateWorkspace(workspaceId, { name: nextName });
      setRenameDrafts((current) => ({ ...current, [workspaceId]: '' }));
    } catch (nextError) {
      setActionError(nextError.message || 'Failed to rename workspace');
    }
  };

  const onDelete = async (workspaceId, workspaceName) => {
    if (!canManage) return;
    const confirmText = `Delete workspace "${workspaceName}"? This action cannot be undone.`;
    if (!window.confirm(confirmText)) return;
    setActionError('');
    try {
      await deleteWorkspace(workspaceId);
    } catch (nextError) {
      setActionError(nextError.message || 'Failed to delete workspace');
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
          <h1 className="text-3xl font-bold tracking-tight text-on-surface">Workspace Settings</h1>
          <p className="mt-2 text-sm text-on-surface-variant">
            Create, switch, rename, and delete workspaces.
          </p>
        </section>

        {error || actionError ? (
          <section className="mb-6 rounded-lg border border-error/30 bg-error/10 px-4 py-3 text-sm text-error">
            {error || actionError}
          </section>
        ) : null}

        <section className="mb-8 rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-on-surface">Create Workspace</h2>
          {!canManage ? (
            <p className="text-sm text-on-surface-variant">Only Owner/Admin can create workspaces.</p>
          ) : (
            <form onSubmit={onCreate} className="grid gap-3 sm:grid-cols-[1fr_auto]">
              <input
                type="text"
                value={newWorkspaceName}
                onChange={(event) => setNewWorkspaceName(event.target.value)}
                placeholder="Workspace name"
                className="rounded-lg border border-outline-variant bg-surface px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={workspaceBusy}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {workspaceBusy ? 'Saving...' : 'Create'}
              </button>
            </form>
          )}
        </section>

        <section className="rounded-xl border border-outline-variant/10 bg-surface-container-lowest p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-on-surface">Workspace List</h2>
          <div className="space-y-3">
            {rows.map((workspace) => {
              const isActive = String(workspace.id) === String(activeWorkspaceId);
              return (
                <div
                  key={workspace.id}
                  className="rounded-lg border border-outline-variant/20 bg-surface p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-on-surface">
                        {workspace.name}
                        {isActive ? (
                          <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-primary">
                            active
                          </span>
                        ) : null}
                      </p>
                      <p className="text-xs text-on-surface-variant">{workspace.slug || '-'}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {!isActive ? (
                        <button
                          type="button"
                          onClick={() => switchWorkspace(workspace.id)}
                          className="rounded-md border border-outline-variant px-3 py-1.5 text-xs font-semibold"
                        >
                          Switch
                        </button>
                      ) : null}
                      {canManage ? (
                        <button
                          type="button"
                          onClick={() => onDelete(workspace.id, workspace.name)}
                          className="rounded-md border border-error/40 px-3 py-1.5 text-xs font-semibold text-error"
                        >
                          Delete
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {canManage ? (
                    <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
                      <input
                        type="text"
                        value={renameDrafts[workspace.id] || ''}
                        onChange={(event) =>
                          setRenameDrafts((current) => ({ ...current, [workspace.id]: event.target.value }))
                        }
                        placeholder="Rename workspace"
                        className="rounded-md border border-outline-variant px-3 py-2 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => onRename(workspace.id)}
                        disabled={workspaceBusy}
                        className="rounded-md bg-surface-container px-3 py-2 text-sm font-semibold disabled:opacity-60"
                      >
                        Rename
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}
            {!rows.length ? <p className="text-sm text-on-surface-variant">No workspaces found.</p> : null}
          </div>
        </section>
      </div>
    </main>
  );
}

export default SettingsWorkspacePage;

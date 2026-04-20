import { useMemo, useState } from 'react';
import Icon from '../../components/ui/Icon';
import { useSettings } from '../../hooks/useSettings';
import { usePermission } from '../../hooks/usePermission';
import SettingsTabs from './SettingsTabs';

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
    <main className="min-h-screen sv-settings-page">
      <div className="mx-auto max-w-6xl px-8 pb-12 pt-2 sv-settings-shell">
        <SettingsTabs />

        <section className="sv-settings-header">
          <h1 className="sv-settings-title">Workspace Settings</h1>
          <p className="sv-settings-subtitle">
            Create, switch, rename, and delete workspaces.
          </p>
        </section>

        {error || actionError ? (
          <section className="sv-settings-alert">
            {error || actionError}
          </section>
        ) : null}

        <section className="sv-settings-card mb-8">
          <h2 className="sv-settings-card-title mb-4">Create Workspace</h2>
          {!canManage ? (
            <p className="sv-settings-note">Only Owner/Admin can create workspaces.</p>
          ) : (
            <form onSubmit={onCreate} className="sv-settings-inline-form">
              <input
                type="text"
                value={newWorkspaceName}
                onChange={(event) => setNewWorkspaceName(event.target.value)}
                placeholder="Workspace name"
                className="sv-settings-input"
              />
              <button
                type="submit"
                disabled={workspaceBusy}
                className="sv-settings-btn sv-settings-btn-primary"
              >
                <Icon name="add_business" className="text-[1rem]" />
                {workspaceBusy ? 'Saving...' : 'Create'}
              </button>
            </form>
          )}
        </section>

        <section className="sv-settings-card">
          <h2 className="sv-settings-card-title mb-4">Workspace List</h2>
          <div className="space-y-3">
            {rows.map((workspace) => {
              const isActive = String(workspace.id) === String(activeWorkspaceId);
              return (
                <div
                  key={workspace.id}
                  className="sv-settings-list-item"
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
                          className="sv-settings-btn sv-settings-btn-neutral"
                        >
                          <Icon name="sync_alt" className="text-[0.95rem]" />
                          Switch
                        </button>
                      ) : null}
                      {canManage ? (
                        <button
                          type="button"
                          onClick={() => onDelete(workspace.id, workspace.name)}
                          className="sv-settings-btn sv-settings-btn-danger"
                        >
                          <Icon name="delete" className="text-[0.95rem]" />
                          Delete
                        </button>
                      ) : null}
                    </div>
                  </div>

                  {canManage ? (
                    <div className="sv-settings-inline-form mt-3">
                      <input
                        type="text"
                        value={renameDrafts[workspace.id] || ''}
                        onChange={(event) =>
                          setRenameDrafts((current) => ({ ...current, [workspace.id]: event.target.value }))
                        }
                        placeholder="Rename workspace"
                        className="sv-settings-input"
                      />
                      <button
                        type="button"
                        onClick={() => onRename(workspace.id)}
                        disabled={workspaceBusy}
                        className="sv-settings-btn sv-settings-btn-neutral"
                      >
                        <Icon name="drive_file_rename_outline" className="text-[0.95rem]" />
                        Rename
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })}
            {!rows.length ? <p className="sv-settings-note">No workspaces found.</p> : null}
          </div>
        </section>
      </div>
    </main>
  );
}

export default SettingsWorkspacePage;

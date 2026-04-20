import { useMemo, useState } from 'react';
import Icon from '../../components/ui/Icon';
import { useSettings } from '../../hooks/useSettings';
import SettingsTabs from './SettingsTabs';

function SettingsSecurityPage() {
  const {
    sessions: liveSessions,
    apiKeys: liveApiKeys,
    auditLog,
    workspaceActivity,
    revokeSession,
    revokeAllOtherSessions,
    loading,
    error,
  } = useSettings();
  const [actionError, setActionError] = useState('');
  const [revokingAll, setRevokingAll] = useState(false);

  const logItems = useMemo(
    () =>
      liveSessions.slice(0, 3).map((session) => ({
        title: `${session.device || 'Device'} session`,
        detail: `${session.lastActiveAt ? new Date(session.lastActiveAt).toLocaleString() : 'Recently'} - ${session.ipAddress || 'N/A'}`,
        active: Boolean(session.isCurrent),
      })),
    [liveSessions],
  );

  const apiKeysData = useMemo(
    () =>
      liveApiKeys.map((key) => ({
        id: key._id,
        name: key.name || 'API Key',
        scope: key.revoked ? 'Revoked' : 'Full Access',
        expiry: key.expiresAt ? `Expires ${new Date(key.expiresAt).toLocaleDateString()}` : 'Never expires',
        token: key.tokenMasked || 'svk_****',
      })),
    [liveApiKeys],
  );

  const sessionsData = useMemo(
    () =>
      liveSessions
        .filter((session) => !session?.revoked)
        .map((session) => ({
        id: session.id || session.sessionId || session._id,
        device: session.device || session.userAgent || 'Device',
        meta: session.isCurrent ? 'Current Session' : session.revoked ? 'Revoked' : 'Session',
        location: session.location || 'Unknown',
        ip: session.ipAddress || 'N/A',
        browser: session.userAgent || 'Unknown Browser',
        lastActive: session.lastActiveAt
          ? new Date(session.lastActiveAt).toLocaleString()
          : session.createdAt
            ? new Date(session.createdAt).toLocaleString()
            : 'Recently',
        current: Boolean(session.isCurrent),
        revoked: Boolean(session.revoked),
        icon: 'desktop_windows',
      })),
    [liveSessions],
  );

  const auditRows = useMemo(
    () =>
      (auditLog || []).map((item) => ({
        id: item._id,
        action: item.action,
        resource: item.resource,
        ip: item.ip,
        time: item.createdAt ? new Date(item.createdAt).toLocaleString() : 'Unknown',
      })),
    [auditLog],
  );

  const activityRows = useMemo(
    () =>
      (workspaceActivity || []).map((item) => ({
        id: item._id,
        module: item.module || 'system',
        action: item.action || 'updated',
        entity: item.entity || 'entity',
        actor: item.actor || 'workspace-user',
        time: item.occurredAt ? new Date(item.occurredAt).toLocaleString() : 'Unknown',
      })),
    [workspaceActivity],
  );

  const handleRevokeSession = async (sessionId) => {
    setActionError('');
    try {
      await revokeSession(sessionId);
    } catch (nextError) {
      setActionError(nextError.message || 'Failed to revoke session');
    }
  };

  const handleRevokeAllOtherSessions = async () => {
    setActionError('');
    setRevokingAll(true);
    try {
      await revokeAllOtherSessions();
    } catch (nextError) {
      setActionError(nextError.message || 'Failed to revoke other sessions');
    } finally {
      setRevokingAll(false);
    }
  };

  return (
    <main className="min-h-screen sv-settings-page">
      <div className="mx-auto max-w-6xl px-8 pb-12 pt-2 sv-settings-shell">
        <SettingsTabs />

        <section className="sv-settings-header mb-10">
          <h2 className="sv-settings-title">Security Settings</h2>
          <p className="sv-settings-subtitle max-w-2xl">Manage your account security, authentication methods, and API access.</p>
        </section>

        {error || actionError ? (
          <section className="sv-settings-alert">
            {error || actionError}
          </section>
        ) : null}

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          <section className="sv-settings-card relative lg:col-span-4">
            <h3 className="sv-settings-card-title mb-6 flex items-center gap-2">
              <Icon name="history" className="text-sm" />
              Security Log
            </h3>
            <div className="relative space-y-6 before:absolute before:bottom-2 before:left-[11px] before:top-2 before:w-[2px] before:bg-outline-variant before:opacity-10 before:content-['']">
              {loading ? (
                <div className="space-y-2">
                  <div className="h-8 animate-pulse rounded bg-surface-container" />
                  <div className="h-8 animate-pulse rounded bg-surface-container" />
                </div>
              ) : (
                logItems.map((item, index) => (
                  <div key={`${item.title}-${item.detail}-${index}`} className="relative pl-8">
                    <div className={`absolute left-0 top-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 bg-surface-container-lowest ${item.active ? 'border-primary' : 'border-outline-variant'}`}>
                      <div className={`h-2 w-2 rounded-full ${item.active ? 'bg-primary' : 'bg-outline-variant'}`} />
                    </div>
                    <p className="text-sm font-medium text-on-surface">{item.title}</p>
                    <p className="text-xs text-on-surface-variant">{item.detail}</p>
                  </div>
                ))
              )}
              {!loading && !logItems.length ? <p className="text-sm text-on-surface-variant">No security activity yet.</p> : null}
            </div>
          </section>

          <section className="sv-settings-card lg:col-span-8">
            <div className="mb-8 flex items-center justify-between">
              <h3 className="sv-settings-card-title">API Access Keys</h3>
              <button className="sv-settings-btn sv-settings-btn-neutral">
                <Icon name="key" className="text-[1rem]" />
                Generate New Token
              </button>
            </div>
            <div className="space-y-4">
              {loading ? (
                <div className="space-y-2">
                  <div className="h-10 animate-pulse rounded bg-surface-container" />
                  <div className="h-10 animate-pulse rounded bg-surface-container" />
                </div>
              ) : (
                apiKeysData.map((key) => (
                  <div key={key.id} className="flex items-center justify-between rounded-lg bg-surface-container-low p-4">
                    <div className="flex items-center gap-4">
                      <div className="rounded-lg bg-surface-container-lowest p-2">
                        <Icon name="key" className="text-on-surface-variant" />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold">{key.name}</h4>
                        <p className="text-xs text-on-surface-variant">{key.scope} - {key.expiry}</p>
                      </div>
                    </div>
                    <code className="rounded bg-surface-container-lowest px-2 py-1 text-xs">{key.token}</code>
                  </div>
                ))
              )}
              {!loading && !apiKeysData.length ? <p className="text-sm text-on-surface-variant">No API keys found.</p> : null}
            </div>
          </section>

          <section className="sv-settings-card overflow-hidden !p-0 lg:col-span-12">
            <div className="flex items-center justify-between border-b border-outline-variant/10 px-8 py-6">
              <h3 className="sv-settings-card-title">Active Sessions</h3>
              <button
                type="button"
                onClick={handleRevokeAllOtherSessions}
                disabled={revokingAll || loading}
                className="sv-settings-btn sv-settings-btn-danger"
              >
                <Icon name="restart_alt" className="text-[0.95rem]" />
                {revokingAll ? 'Revoking...' : 'Revoke All Other Sessions'}
              </button>
            </div>
            <div className="sv-settings-scroll-area sv-settings-scroll-area-lg overflow-auto">
              <table className="sv-settings-table">
                <thead>
                  <tr>
                    <th className="px-8 py-4">Device / Browser</th>
                    <th className="px-8 py-4">Location</th>
                    <th className="px-8 py-4">IP Address</th>
                    <th className="px-8 py-4">Last Active</th>
                    <th className="px-8 py-4" />
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-8 py-8">
                        <div className="space-y-2">
                          <div className="h-8 animate-pulse rounded bg-surface-container" />
                          <div className="h-8 animate-pulse rounded bg-surface-container" />
                        </div>
                      </td>
                    </tr>
                  ) : sessionsData.map((session) => (
                    <tr key={session.id} className="transition-colors hover:bg-surface-container-low/50">
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-3">
                          <Icon name={session.icon} className={session.current ? 'text-primary' : 'text-on-surface-variant'} />
                          <div>
                            <p className="text-sm font-semibold">{session.device}</p>
                            <p className={`text-xs ${session.current ? 'font-medium text-green-600' : 'text-on-surface-variant'}`}>
                              {session.meta} - {session.browser}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-5 text-sm text-on-surface-variant">{session.location}</td>
                      <td className="px-8 py-5 font-mono text-sm">{session.ip}</td>
                      <td className="px-8 py-5 text-sm text-on-surface-variant">{session.lastActive}</td>
                      <td className="px-8 py-5 text-right">
                        {session.current || session.revoked ? (
                          <button disabled className="cursor-not-allowed text-xs font-bold uppercase tracking-wider text-outline">{session.current ? 'Current' : 'Revoked'}</button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleRevokeSession(session.id)}
                            className="sv-settings-btn sv-settings-btn-danger"
                          >
                            <Icon name="block" className="text-[0.95rem]" />
                            Revoke
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!loading && !sessionsData.length ? (
                    <tr>
                      <td colSpan={5} className="px-8 py-8 text-center text-sm text-on-surface-variant">No active sessions found.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className="sv-settings-card overflow-hidden !p-0 lg:col-span-6">
            <div className="border-b border-outline-variant/10 px-8 py-6">
              <h3 className="sv-settings-card-title">Workspace Audit Log</h3>
            </div>
            <div className="sv-settings-scroll-area">
              <table className="sv-settings-table">
                <thead>
                  <tr>
                    <th className="px-6 py-3">Action</th>
                    <th className="px-6 py-3">Resource</th>
                    <th className="px-6 py-3">IP</th>
                    <th className="px-6 py-3">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {auditRows.map((row) => (
                    <tr key={row.id}>
                      <td className="px-6 py-3 text-xs font-semibold text-on-surface">{row.action}</td>
                      <td className="px-6 py-3 text-xs text-on-surface-variant">{row.resource}</td>
                      <td className="px-6 py-3 font-mono text-xs text-on-surface-variant">{row.ip || '-'}</td>
                      <td className="px-6 py-3 text-xs text-on-surface-variant">{row.time}</td>
                    </tr>
                  ))}
                  {!auditRows.length ? (
                    <tr>
                      <td colSpan={4} className="px-6 py-8 text-center text-sm text-on-surface-variant">No audit log entries.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className="sv-settings-card overflow-hidden !p-0 lg:col-span-6">
            <div className="border-b border-outline-variant/10 px-8 py-6">
              <h3 className="sv-settings-card-title">Workspace Activity</h3>
            </div>
            <div className="max-h-96 overflow-auto">
              <table className="sv-settings-table">
                <thead>
                  <tr>
                    <th className="px-6 py-3">Module</th>
                    <th className="px-6 py-3">Action</th>
                    <th className="px-6 py-3">Entity</th>
                    <th className="px-6 py-3">Actor</th>
                    <th className="px-6 py-3">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {activityRows.map((row) => (
                    <tr key={row.id}>
                      <td className="px-6 py-3 text-xs font-semibold text-on-surface">{row.module}</td>
                      <td className="px-6 py-3 text-xs text-on-surface-variant">{row.action}</td>
                      <td className="px-6 py-3 text-xs text-on-surface-variant">{row.entity}</td>
                      <td className="px-6 py-3 text-xs text-on-surface-variant">{row.actor}</td>
                      <td className="px-6 py-3 text-xs text-on-surface-variant">{row.time}</td>
                    </tr>
                  ))}
                  {!activityRows.length ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-8 text-center text-sm text-on-surface-variant">No workspace activity yet.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

export default SettingsSecurityPage;

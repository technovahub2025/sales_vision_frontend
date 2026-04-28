import { useQuery } from '@tanstack/react-query';
import Icon from '../../components/ui/Icon';
import { superAdminApi } from '../../api/superAdmin.api';
import {
  AdminKpiCard,
  AdminState,
  StatusBadge,
  SuperAdminPageHeader,
  formatAdminDate,
  formatAdminNumber,
} from './SuperAdminShared';
import '../../styles/superadmin.css';

const KPI_CONFIG = [
  ['activeSessions', 'Active sessions', 'devices'],
  ['revokedSessions', 'Revoked sessions', 'block'],
  ['activeApiKeys', 'Active API keys', 'key'],
  ['revokedApiKeys', 'Revoked API keys', 'key_off'],
  ['pendingInvites', 'Pending invites', 'mail'],
  ['expiredInvites', 'Expired invites', 'event_busy'],
];

function CompactTable({ title, text, columns, rows, empty, loading }) {
  return (
    <section className="sv-userdatas-table-card" aria-label={title}>
      <div className="sv-userdatas-table-head">
        <div><h2>{title}</h2><p>{text}</p></div>
        <span>{formatAdminNumber(rows.length)} shown</span>
      </div>
      <div className="sv-userdatas-table-wrap">
        <table className="sv-userdatas-table sv-admin-security-table">
          <thead>
            <tr>{columns.map((column) => <th key={column.key}>{column.label}</th>)}</tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={columns.length} className="sv-userdatas-state"><AdminState icon="progress_activity" title={`Loading ${title.toLowerCase()}`} /></td></tr> : null}
            {!loading && !rows.length ? <tr><td colSpan={columns.length} className="sv-userdatas-state"><AdminState icon="inbox" title={empty} /></td></tr> : null}
            {rows.map((row) => (
              <tr key={row.id}>
                {columns.map((column) => <td key={column.key}>{column.render(row)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function SuperAdminSecurityPage() {
  const securityQuery = useQuery({
    queryKey: ['super-admin', 'security'],
    queryFn: ({ signal }) => superAdminApi.security({ limit: 10 }, signal),
    retry: false,
  });

  const data = securityQuery.data?.data || {};
  const metrics = data.metrics || {};

  return (
    <main className="sv-superadmin-page container-fluid px-3 px-md-4 px-xl-5 pb-5 pb-lg-6">
      <SuperAdminPageHeader
        eyebrow="Security Center"
        title="Security"
        badge={securityQuery.isLoading ? 'Loading security' : 'Read-only'}
        badgeIcon="lock"
      />

      {securityQuery.isError ? (
        <div className="sv-userdatas-error sv-admin-inline-alert"><Icon name="error" />Unable to load security center. Refresh and try again.</div>
      ) : null}

      <section className="sv-admin-kpi-grid" aria-label="Security metrics">
        {KPI_CONFIG.map(([key, label, icon]) => (
          <AdminKpiCard
            key={key}
            icon={icon}
            value={metrics[key]}
            label={label}
            loading={securityQuery.isLoading}
            tone={key.includes('revoked') || key.includes('expired') ? 'risk' : 'neutral'}
          />
        ))}
      </section>

      <div className="sv-admin-stack">
        <CompactTable
          title="Recent Sessions"
          text="Latest security sessions across all workspaces."
          rows={data.sessions || []}
          empty="No sessions found."
          loading={securityQuery.isLoading}
          columns={[
            { key: 'workspace', label: 'Workspace', render: (row) => <div className="sv-userdatas-two-line"><strong>{row.workspace?.name || '-'}</strong><small>{row.workspace?.slug || ''}</small></div> },
            { key: 'device', label: 'Device', render: (row) => row.device },
            { key: 'ip', label: 'IP', render: (row) => row.ipAddress || '-' },
            { key: 'status', label: 'Status', render: (row) => <StatusBadge tone={row.revoked ? 'inactive' : 'healthy'} icon={row.revoked ? 'block' : 'check_circle'}>{row.revoked ? 'Revoked' : 'Active'}</StatusBadge> },
            { key: 'last', label: 'Last active', render: (row) => formatAdminDate(row.lastActiveAt) },
          ]}
        />

        <CompactTable
          title="API Keys"
          text="Workspace API key inventory."
          rows={data.apiKeys || []}
          empty="No API keys found."
          loading={securityQuery.isLoading}
          columns={[
            { key: 'workspace', label: 'Workspace', render: (row) => row.workspace?.name || '-' },
            { key: 'name', label: 'Name', render: (row) => row.name },
            { key: 'token', label: 'Token', render: (row) => row.tokenMasked },
            { key: 'status', label: 'Status', render: (row) => <StatusBadge tone={row.revoked ? 'inactive' : 'healthy'} icon={row.revoked ? 'block' : 'check_circle'}>{row.revoked ? 'Revoked' : 'Active'}</StatusBadge> },
            { key: 'last', label: 'Last used', render: (row) => formatAdminDate(row.lastUsedAt) },
          ]}
        />

        <CompactTable
          title="Invites"
          text="Latest workspace invitations."
          rows={data.invites || []}
          empty="No invites found."
          loading={securityQuery.isLoading}
          columns={[
            { key: 'workspace', label: 'Workspace', render: (row) => row.workspace?.name || '-' },
            { key: 'email', label: 'Email', render: (row) => row.email },
            { key: 'role', label: 'Role', render: (row) => row.role },
            { key: 'status', label: 'Status', render: (row) => <StatusBadge tone={row.status === 'pending' ? 'neutral' : 'inactive'} icon={row.status === 'pending' ? 'mail' : 'event_busy'}>{row.status || '-'}</StatusBadge> },
            { key: 'expires', label: 'Expires', render: (row) => formatAdminDate(row.expiresAt) },
          ]}
        />

        <CompactTable
          title="Audit Events"
          text="Recent audit records."
          rows={data.auditEvents || []}
          empty="No audit events found."
          loading={securityQuery.isLoading}
          columns={[
            { key: 'workspace', label: 'Workspace', render: (row) => row.workspace?.name || '-' },
            { key: 'action', label: 'Action', render: (row) => row.action },
            { key: 'resource', label: 'Resource', render: (row) => row.resource },
            { key: 'ip', label: 'IP', render: (row) => row.ip || '-' },
            { key: 'created', label: 'Created', render: (row) => formatAdminDate(row.createdAt) },
          ]}
        />
      </div>
    </main>
  );
}

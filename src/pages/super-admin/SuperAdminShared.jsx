import { Link } from 'react-router-dom';
import Icon from '../../components/ui/Icon';
import { ROUTES } from '../../routes/routePaths';

export const HEALTH_LABELS = {
  healthy: 'Healthy',
  needs_owner: 'Needs owner',
  overdue_risk: 'Overdue risk',
  inactive: 'Inactive',
  invite_pending: 'Invite pending',
};

export function formatAdminNumber(value) {
  return new Intl.NumberFormat().format(Number(value || 0));
}

export function formatAdminDate(value, options) {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleString(undefined, options);
}

export function adminHealthLabel(value) {
  return HEALTH_LABELS[value] || String(value || 'Unknown');
}

export function SuperAdminPageHeader({
  eyebrow,
  title,
  badge,
  badgeIcon = 'verified',
  back = true,
}) {
  return (
    <header className="sv-userdatas-head sv-superadmin-hero">
      <div>
        {back ? (
          <Link to={ROUTES.superAdmin} className="sv-userdatas-back">
            <Icon name="arrow_back" />
            Back to Admin
          </Link>
        ) : null}
        <p className="sv-superadmin-eyebrow mb-0">{eyebrow}</p>
        <h1 className="mb-0">{title}</h1>
      </div>
      {badge ? (
        <div className="sv-userdatas-total sv-superadmin-readonly-pill">
          <Icon name={badgeIcon} />
          {badge}
        </div>
      ) : null}
    </header>
  );
}

export function AdminKpiCard({ icon, value, label, tone = 'neutral', loading = false }) {
  return (
    <article className={`sv-admin-kpi-card is-${tone}`}>
      <span><Icon name={icon} /></span>
      <div>
        <strong>{loading ? '-' : formatAdminNumber(value)}</strong>
        <small>{label}</small>
      </div>
    </article>
  );
}

export function AdminState({ icon = 'inbox', title, text }) {
  return (
    <div className="sv-admin-state">
      <span><Icon name={icon} /></span>
      <strong>{title}</strong>
      {text ? <small>{text}</small> : null}
    </div>
  );
}

export function HealthBadge({ value }) {
  return (
    <span className={`sv-admin-health-badge is-${value || 'neutral'}`}>
      {adminHealthLabel(value)}
    </span>
  );
}

export function StatusBadge({ children, tone = 'neutral', icon }) {
  return (
    <span className={`sv-admin-health-badge is-${tone}`}>
      {icon ? <Icon name={icon} /> : null}
      {children}
    </span>
  );
}

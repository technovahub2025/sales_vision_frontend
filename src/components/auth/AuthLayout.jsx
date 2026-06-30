import { Link } from 'react-router-dom';
import AppFooter from '../layout/AppFooter';
import ThemeModeToggle from '../ui/ThemeModeToggle';

export default function AuthLayout({
  title,
  subtitle,
  children,
  footer,
  showThemeToggle = true,
  compact = false,
}) {
  const logoLight = `${import.meta.env.BASE_URL}assets/light_logo.jpeg`;
  const logoDark = `${import.meta.env.BASE_URL}assets/dark_logo.jpeg`;
  const logoSecondary = `${import.meta.env.BASE_URL}assets/logo_2.png`;
  const featureItems = [
    { title: 'Realtime KPI dashboard', detail: 'Track delivery, sales, and workforce health in one workspace.' },
    { title: 'Pipeline conversion tracking', detail: 'Understand every lead stage and revenue movement.' },
    { title: 'Role-based controls', detail: 'Keep each workspace secure with clear ownership.' },
    { title: 'Export-ready analytics', detail: 'Download board, sales, and activity data when needed.' },
  ];

  return (
    <div className={`sv-auth-shell ${compact ? 'is-compact' : ''}`}>
      <div className="sv-auth-orb sv-auth-orb-a" aria-hidden="true" />
      <div className="sv-auth-orb sv-auth-orb-b" aria-hidden="true" />
      <div className="sv-auth-container">
        {showThemeToggle ? (
          <div className="sv-auth-theme">
            <ThemeModeToggle />
          </div>
        ) : null}
        <div className={`sv-auth-inner ${compact ? 'is-compact' : ''}`}>
          <div className="sv-auth-grid">
            <section className="sv-auth-form-column">
              <article className="sv-auth-card sv-reveal">
                <div className="sv-auth-brand-row">
                  <span className="sv-auth-logo-wrap">
                    <img src={logoSecondary} alt="Technova Hub" className="sv-auth-logo-secondary" loading="eager" decoding="async" />
                    <img src={logoLight} alt="Sales Vision" className="sv-logo sv-logo-light" loading="eager" decoding="async" />
                    <img src={logoDark} alt="Sales Vision" className="sv-logo sv-logo-dark" loading="eager" decoding="async" />
                  </span>
                  <span className="sv-auth-badge">Secure workspace</span>
                </div>
                <div className="sv-auth-copy">
                  <p className="sv-auth-kicker">SalesVision CRM</p>
                  <h1 className="sv-auth-title sv-heading">{title}</h1>
                  <p className="sv-auth-subtitle">{subtitle}</p>
                </div>

                <div className="sv-auth-form-slot">{children}</div>

                {footer ? <div className="sv-auth-footer-note">{footer}</div> : null}
              </article>
            </section>

            <aside className="sv-auth-marketing-column">
              <article className="sv-auth-panel text-white sv-reveal sv-reveal-delay-1">
                <div className="sv-auth-panel-content">
                  <div className="sv-auth-panel-eyebrow">
                    <span className="sv-auth-live-dot" />
                    Live pipeline intelligence
                  </div>
                  <h2 className="sv-auth-panel-title sv-heading">See opportunities. Close faster.</h2>
                  <p className="sv-auth-panel-subtitle">A focused command center for deal visibility, team execution, and actionable reporting.</p>

                  <div className="sv-auth-metrics" aria-label="SalesVision highlights">
                    <div>
                      <strong>360</strong>
                      <span>workspace view</span>
                    </div>
                    <div>
                      <strong>4</strong>
                      <span>core workflows</span>
                    </div>
                    <div>
                      <strong>24/7</strong>
                      <span>activity signal</span>
                    </div>
                  </div>

                  <div className="sv-auth-feature-grid">
                    {featureItems.map((item) => (
                      <div key={item.title} className="sv-auth-feature">
                        <i className="bi bi-check2-circle" aria-hidden="true" />
                        <div>
                          <span>{item.title}</span>
                          <small>{item.detail}</small>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="sv-auth-panel-footer">
                    <span>Need help?</span>
                    <Link className="text-white fw-semibold" to="#">Contact Support</Link>
                  </div>
                </div>
                <div className="sv-auth-preview-card" aria-hidden="true">
                  <div className="sv-auth-preview-header">
                    <span />
                    <span />
                    <span />
                  </div>
                  <div className="sv-auth-preview-row">
                    <span>Pipeline value</span>
                    <strong>Rs.8.4L</strong>
                  </div>
                  <div className="sv-auth-preview-bars">
                    <span className="is-a" />
                    <span className="is-b" />
                    <span className="is-c" />
                  </div>
                </div>
              </article>
            </aside>
          </div>
        </div>
      </div>
      <AppFooter />
    </div>
  );
}

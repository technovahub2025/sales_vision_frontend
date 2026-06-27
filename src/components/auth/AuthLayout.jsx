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

  return (
    <div className={`sv-auth-shell ${compact ? 'min-vh-100 d-flex flex-column justify-content-center py-3' : 'min-vh-100 d-flex flex-column py-4 py-lg-5'}`}>
      <div className={`container-fluid flex-grow-1 px-3 px-md-4 px-xl-5 w-100 ${compact ? 'd-flex flex-column justify-content-center' : ''}`}>
        {showThemeToggle ? (
          <div className="d-flex justify-content-end mb-3 mb-lg-4">
            <ThemeModeToggle />
          </div>
        ) : null}
        <div className="mx-auto" style={{ maxWidth: compact ? 1320 : 1400 }}>
          <div className={`row justify-content-center g-4 g-xl-5 ${compact ? 'align-items-center' : 'align-items-stretch'}`}>
            <section className={compact ? 'col-12 col-lg-5 col-xl-5' : 'col-12 col-lg-6 col-xl-5'}>
            <article className="sv-auth-card p-4 p-lg-5 h-100 sv-reveal">
              <div className="mb-3">
                <img src={logoLight} alt="Sales Vision" className="sv-logo sv-logo-light" />
                <img src={logoDark} alt="Sales Vision" className="sv-logo sv-logo-dark" />
              </div>
              <h1 className="h2 fw-bold mb-2 sv-heading">{title}</h1>
              <p className="mb-4 text-secondary">{subtitle}</p>

              <div className="d-grid gap-3">{children}</div>

              {footer ? <div className="small mt-4 text-secondary">{footer}</div> : null}
            </article>
            </section>

            <aside className={compact ? 'col-12 col-lg-6 col-xl-6' : 'col-12 col-lg-6 col-xl-6'}>
              <article className={`sv-auth-panel text-white sv-reveal sv-reveal-delay-1 ${compact ? 'p-4' : 'p-4 p-lg-5 h-100'}`}>
              <h2 className="display-6 fw-bold mb-3 sv-heading">See Opportunities. Close Faster.</h2>
              <p className="mb-4 fs-5">B2B sales intelligence workspace with deal flow visibility, team execution analytics, and actionable reporting.</p>
              <div className="row g-3">
                {[
                  'Realtime KPI dashboard',
                  'Pipeline visibility and conversion tracking',
                  'Role-based workspace controls',
                  'Action-ready analytics export',
                ].map((item) => (
                  <div key={item} className="col-12 col-md-6">
                    <div className="sv-auth-feature rounded-3 p-3 h-100">
                      <i className="bi bi-check2-circle me-2" aria-hidden="true" />
                      <span>{item}</span>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-4 mb-0 small">
                Need help? <Link className="text-white fw-semibold" to="#">Contact Support</Link>
              </p>
            </article>
            </aside>
          </div>
        </div>
      </div>
      <AppFooter />
    </div>
  );
}

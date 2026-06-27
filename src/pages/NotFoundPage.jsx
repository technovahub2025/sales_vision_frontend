import { Link } from 'react-router-dom'
import AppFooter from '../components/layout/AppFooter'
import { ROUTES } from '../routes/routePaths'

function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-950">
      <main className="flex flex-1 items-center justify-center px-4 text-slate-100">
        <div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-6 text-center">
          <h1 className="text-2xl font-bold">Page Not Found</h1>
          <p className="mt-2 text-sm text-slate-400">This route does not exist in the SalesVision SaaS workspace.</p>
          <Link
            to={ROUTES.dashboard}
            className="mt-5 inline-flex rounded-lg border border-cyan-400/40 bg-cyan-400/10 px-4 py-2 text-sm font-semibold text-cyan-100"
          >
            Go to Dashboard
          </Link>
        </div>
      </main>
      <AppFooter />
    </div>
  )
}

export default NotFoundPage

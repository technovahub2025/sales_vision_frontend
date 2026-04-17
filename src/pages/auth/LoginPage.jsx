import { z } from 'zod';
import { useEffect } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import AuthLayout from '../../components/auth/AuthLayout';
import { FormAlert, TextField } from '../../components/auth/AuthFormControls';
import { useAuth } from '../../contexts/AuthContext';
import { useRetryCountdown } from '../../hooks/auth/useRetryCountdown';
import { ROUTES } from '../../routes/routePaths';
import { setThemeMode } from '../../lib/theme';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, login, loginState } = useAuth();

  const { register, handleSubmit, formState } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
    mode: 'onBlur',
  });

  const countdown = useRetryCountdown(loginState.error?.retryAfterSeconds || 0);

  useEffect(() => {
    setThemeMode('system');
  }, []);

  if (isAuthenticated) {
    return <Navigate replace to={ROUTES.dashboard} />;
  }

  async function onSubmit(values) {
    await login(values);
    const to = location.state?.from || ROUTES.dashboard;
    navigate(to, { replace: true });
  }

  const oauthEnabled = import.meta.env.VITE_ENABLE_OAUTH_PLACEHOLDER !== 'false';

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to continue to your workspace."
      showThemeToggle={false}
      compact
      footer={<span>New here? <Link className="fw-semibold link-primary" to={ROUTES.register}>Create an account</Link></span>}
    >
      <form className="d-grid gap-3" onSubmit={handleSubmit(onSubmit)} noValidate>
        <TextField
          id="login-email"
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="Enter your email"
          register={register('email')}
          error={formState.errors.email?.message}
          floating={false}
        />
        <TextField
          id="login-password"
          label="Password"
          type="password"
          autoComplete="current-password"
          placeholder="Enter your password"
          register={register('password')}
          error={formState.errors.password?.message}
          showPasswordToggle
          floating={false}
        />

        <FormAlert message={loginState.error?.message} />

        {countdown > 0 ? (
          <FormAlert tone="error" message={`Too many attempts, wait ${countdown}s before retrying.`} />
        ) : null}

        <button
          type="submit"
          disabled={loginState.isPending || countdown > 0}
          className="btn btn-primary w-100 fw-semibold py-2"
        >
          {loginState.isPending ? 'Signing in...' : 'Sign in'}
        </button>
      </form>

      <div className="my-4 d-flex align-items-center gap-3 text-secondary small">
        <div className="border-top flex-grow-1" />
        <span>OR</span>
        <div className="border-top flex-grow-1" />
      </div>

      <div className="d-grid gap-2">
        <button type="button" disabled={!oauthEnabled} className="btn btn-outline-secondary py-2">
          Continue with GitHub
        </button>
        <button type="button" disabled={!oauthEnabled} className="btn btn-outline-secondary py-2">
          Continue with Google
        </button>
      </div>

      <p className="mt-4 text-end small">
        <Link className="link-primary" to={ROUTES.forgotPassword}>Forgot password?</Link>
      </p>
    </AuthLayout>
  );
}

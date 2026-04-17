import { z } from 'zod';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import AuthLayout from '../../components/auth/AuthLayout';
import { FormAlert, TextField } from '../../components/auth/AuthFormControls';
import { useAuth } from '../../contexts/AuthContext';
import { useRetryCountdown } from '../../hooks/auth/useRetryCountdown';
import { ROUTES } from '../../routes/routePaths';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
});

export default function ForgotPasswordPage() {
  const { forgotPassword, forgotPasswordState } = useAuth();

  const { register, handleSubmit, formState } = useForm({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
    mode: 'onBlur',
  });

  const countdown = useRetryCountdown(forgotPasswordState.error?.retryAfterSeconds || 0);

  async function onSubmit(values) {
    await forgotPassword(values);
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="We will send a secure reset link to your email."
      compact
      showThemeToggle={false}
      footer={<span>Remembered your password? <Link className="fw-semibold link-primary" to={ROUTES.login}>Back to sign in</Link></span>}
    >
      <form className="d-grid gap-3" onSubmit={handleSubmit(onSubmit)} noValidate>
        <TextField id="forgot-email" label="Email" type="email" placeholder="Enter your email" autoComplete="email" register={register('email')} error={formState.errors.email?.message} floating={false} />

        <FormAlert message={forgotPasswordState.error?.message} />
        {forgotPasswordState.isSuccess ? (
          <FormAlert tone="success" message="If that account exists, a reset link has been sent." />
        ) : null}
        {countdown > 0 ? (
          <FormAlert message={`Too many attempts, wait ${countdown}s before retrying.`} />
        ) : null}

        <button
          type="submit"
          disabled={forgotPasswordState.isPending || countdown > 0}
          className="btn btn-primary w-100 fw-semibold py-2"
        >
          {forgotPasswordState.isPending ? 'Sending...' : 'Send reset link'}
        </button>
      </form>
    </AuthLayout>
  );
}
